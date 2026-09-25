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

/**
 * Bloqueio por tentativas erradas seguidas: depois de `maxAttempts` erros, a chave fica
 * bloqueada por `lockSeconds`. Sem tentativas por `resetAfterSeconds`, a contagem recomeça.
 */
export interface LockoutRule {
  bucket: string;
  maxAttempts: number;
  resetAfterSeconds: number;
  lockSeconds: number;
}

export interface LockoutAttempt {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Quantas tentativas ainda restam se esta der errado (0 = esta é a última). */
  remaining: number;
}

/** Regras padrão do sistema. */
export const RATE_LIMITS = {
  leadHourly: { bucket: 'lead-h', limit: 5, windowSeconds: 60 * 60 },
  leadDaily: { bucket: 'lead-d', limit: 15, windowSeconds: 60 * 60 * 24 },
  /** Teto diário por IP: impede o "conta-gotas" de 5 tentativas a cada bloqueio o dia inteiro. */
  loginDaily: { bucket: 'login-d', limit: 30, windowSeconds: 60 * 60 * 24 },
  favoritesPartial: { bucket: 'fav', limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/** Login do painel: 5 senhas erradas seguidas bloqueiam o IP por 30 minutos. */
export const LOGIN_LOCKOUT: LockoutRule = {
  bucket: 'login',
  maxAttempts: 5,
  resetAfterSeconds: 30 * 60,
  lockSeconds: 30 * 60,
};

/**
 * Teto somando todos os IPs (ataque distribuído, cada IP com poucas tentativas): 100 tentativas
 * seguidas pausam o login de todos por 30 minutos. Quem já está logado continua usando o painel.
 */
export const LOGIN_GLOBAL_LOCKOUT: LockoutRule = {
  bucket: 'login-all',
  maxAttempts: 100,
  resetAfterSeconds: 60 * 60,
  lockSeconds: 30 * 60,
};

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

  private async lockoutKeys(rule: LockoutRule, identifier: string) {
    const hashed = (await this.hashIdentifier(identifier)).slice(0, 32);
    return { counter: `${rule.bucket}-n:${hashed}`, lock: `${rule.bucket}-b:${hashed}` };
  }

  /**
   * Registra uma tentativa ANTES de conferir a senha. Contar antes (e não só depois do erro)
   * impede que várias requisições em paralelo escapem do limite. Bloqueado, recusa sem gravar.
   */
  async beginAttempt(
    rule: LockoutRule,
    identifier: string,
    options: RateLimitCheckOptions = {},
  ): Promise<LockoutAttempt> {
    const nowSeconds = Math.floor(this.now() / 1000);
    const keys = await this.lockoutKeys(rule, identifier);

    const cached = blockedUntil.get(keys.lock);
    if (cached !== undefined) {
      if (cached > nowSeconds) return { allowed: false, retryAfterSeconds: cached - nowSeconds, remaining: 0 };
      blockedUntil.delete(keys.lock);
    }

    try {
      const until = await this.repo.lockedUntil(keys.lock);
      if (until > nowSeconds) {
        rememberBlocked(keys.lock, until);
        return { allowed: false, retryAfterSeconds: until - nowSeconds, remaining: 0 };
      }
      const count = await this.repo.hitStreak(keys.counter, nowSeconds, nowSeconds - rule.resetAfterSeconds);
      if (count > rule.maxAttempts) {
        // Só acontece com requisições simultâneas: bloqueia já, sem conferir a senha.
        await this.lock(rule, keys, nowSeconds);
        return { allowed: false, retryAfterSeconds: rule.lockSeconds, remaining: 0 };
      }
      return { allowed: true, retryAfterSeconds: 0, remaining: rule.maxAttempts - count };
    } catch (error) {
      console.error('[rate-limit] falha ao registrar tentativa', error);
      if (options.failClosed) return { allowed: false, retryAfterSeconds: 60, remaining: 0 };
      return { allowed: true, retryAfterSeconds: 0, remaining: rule.maxAttempts };
    }
  }

  /** Chamado quando a tentativa deu errado. Retorna true se ela bloqueou a chave. */
  async recordFailure(rule: LockoutRule, identifier: string, attempt: LockoutAttempt): Promise<boolean> {
    if (attempt.remaining > 0) return false;
    const nowSeconds = Math.floor(this.now() / 1000);
    await this.lock(rule, await this.lockoutKeys(rule, identifier), nowSeconds);
    return true;
  }

  /** Tentativa certa: zera a sequência de erros. */
  async clearAttempts(rule: LockoutRule, identifier: string): Promise<void> {
    const keys = await this.lockoutKeys(rule, identifier);
    await this.repo.reset(keys.counter).catch(() => undefined);
  }

  private async lock(rule: LockoutRule, keys: { counter: string; lock: string }, nowSeconds: number) {
    const until = nowSeconds + rule.lockSeconds;
    rememberBlocked(keys.lock, until);
    try {
      await this.repo.lock(keys.lock, until);
      await this.repo.reset(keys.counter);
    } catch (error) {
      // O bloqueio em memória já vale nesta instância; a próxima leitura do banco decide nas outras.
      console.error('[rate-limit] falha ao gravar bloqueio', error);
    }
  }

  async reset(rule: RateLimitRule, identifier: string): Promise<void> {
    const hashed = (await this.hashIdentifier(identifier)).slice(0, 32);
    const key = `${rule.bucket}:${hashed}`;
    blockedUntil.delete(key);
    await this.repo.reset(key).catch(() => undefined);
  }
}
