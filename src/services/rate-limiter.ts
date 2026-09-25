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
  /** Teto diário por IP: impede o "conta-gotas" de 6 tentativas a cada 15 minutos o dia inteiro. */
  loginDaily: { bucket: 'login-d', limit: 30, windowSeconds: 60 * 60 * 24 },
  favoritesPartial: { bucket: 'fav', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitCheckOptions {
  /**
   * Se o banco falhar: `false` (padrão) libera a requisição para não derrubar o site;
   * `true` bloqueia — usado no login, onde liberar sem contar abriria espaço para força bruta.
   */
  failClosed?: boolean;
}

/**
 * Identificadores já bloqueados nesta instância (chave -> fim do bloqueio, em segundos).
 * Enquanto o bloqueio vale, novas tentativas são recusadas sem gravar no banco: um robô
 * insistindo não consegue esgotar a cota diária de escrita do D1.
 */
const blockedUntil = new Map<string, number>();
const MAX_BLOCKED_ENTRIES = 5000;

function rememberBlocked(key: string, untilSeconds: number) {
  if (!blockedUntil.has(key) && blockedUntil.size >= MAX_BLOCKED_ENTRIES) {
    const oldest = blockedUntil.keys().next().value;
    if (oldest !== undefined) blockedUntil.delete(oldest);
  }
  blockedUntil.set(key, untilSeconds);
}

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

  async check(rule: RateLimitRule, identifier: string, options: RateLimitCheckOptions = {}): Promise<RateLimitResult> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const windowStart = nowSeconds - (nowSeconds % rule.windowSeconds);
    const hashed = (await this.hashIdentifier(identifier)).slice(0, 32);
    const key = `${rule.bucket}:${hashed}`;

    const until = blockedUntil.get(key);
    if (until !== undefined) {
      if (until > nowSeconds) return { allowed: false, count: rule.limit + 1, retryAfterSeconds: until - nowSeconds };
      blockedUntil.delete(key);
    }

    try {
      const count = await this.repo.hit(key, windowStart);
      // Limpeza ocasional de janelas antigas (~1% das chamadas).
      if (Math.random() < 0.01) {
        void this.repo.purgeBefore(nowSeconds - 60 * 60 * 48).catch(() => undefined);
      }
      const retryAfterSeconds = windowStart + rule.windowSeconds - nowSeconds;
      if (count > rule.limit) rememberBlocked(key, nowSeconds + retryAfterSeconds);
      return { allowed: count <= rule.limit, count, retryAfterSeconds };
    } catch (error) {
      console.error('[rate-limit] falha ao registrar tentativa', error);
      if (options.failClosed) return { allowed: false, count: 0, retryAfterSeconds: 60 };
      // Formulários públicos: falha no banco não derruba o site (o Turnstile continua ativo).
      return { allowed: true, count: 0, retryAfterSeconds: 0 };
    }
  }

  async reset(rule: RateLimitRule, identifier: string): Promise<void> {
    const hashed = (await this.hashIdentifier(identifier)).slice(0, 32);
    const key = `${rule.bucket}:${hashed}`;
    blockedUntil.delete(key);
    await this.repo.reset(key).catch(() => undefined);
  }
}
