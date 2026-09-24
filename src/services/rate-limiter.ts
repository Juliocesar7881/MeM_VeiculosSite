import type { RateLimitRepository } from '@/repositories/rate-limit-repository';

export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  retryAfterSeconds: number;
}

/** Regras padrão do sistema. */
export const RATE_LIMITS = {
  leadHourly: { bucket: 'lead-h', limit: 5, windowSeconds: 60 * 60 },
  leadDaily: { bucket: 'lead-d', limit: 15, windowSeconds: 60 * 60 * 24 },
  loginFailures: { bucket: 'login', limit: 6, windowSeconds: 15 * 60 },
  favoritesPartial: { bucket: 'fav', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Rate limiting distribuído via banco. IPs nunca são gravados em claro:
 * usamos SHA-256(salt + ip), atendendo à minimização de dados da LGPD.
 */
export class RateLimiter {
  constructor(
    private readonly repo: RateLimitRepository,
    private readonly salt: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  hashIdentifier(identifier: string): Promise<string> {
    return sha256Hex(`${this.salt}:${identifier}`);
  }

  async check(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const windowStart = nowSeconds - (nowSeconds % rule.windowSeconds);
    const hashed = (await this.hashIdentifier(identifier)).slice(0, 32);
    const key = `${rule.bucket}:${hashed}`;
    try {
      const count = await this.repo.hit(key, windowStart);
      // Limpeza ocasional de janelas antigas (~1% das chamadas).
      if (Math.random() < 0.01) {
        void this.repo.purgeBefore(nowSeconds - 60 * 60 * 48).catch(() => undefined);
      }
      return {
        allowed: count <= rule.limit,
        count,
        retryAfterSeconds: windowStart + rule.windowSeconds - nowSeconds,
      };
    } catch (error) {
      // Falha no banco não deve derrubar o site: registra e permite (Turnstile continua ativo).
      console.error('[rate-limit] falha ao registrar tentativa', error);
      return { allowed: true, count: 0, retryAfterSeconds: 0 };
    }
  }

  async reset(rule: RateLimitRule, identifier: string): Promise<void> {
    const hashed = (await this.hashIdentifier(identifier)).slice(0, 32);
    await this.repo.reset(`${rule.bucket}:${hashed}`).catch(() => undefined);
  }
}
