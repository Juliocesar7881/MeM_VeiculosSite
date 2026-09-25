import { verifyPassword } from '@/lib/auth/password';
import { LOGIN_GLOBAL_LOCKOUT, LOGIN_LOCKOUT, RATE_LIMITS, type RateLimiter } from '@/services/rate-limiter';

export type AdminLoginResult = { ok: true } | { ok: false; error: string };

/** Identificador do teto que soma todos os IPs. */
const EVERYONE = 'todos-os-ips';

function minutes(seconds: number): string {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
}

/**
 * Confere a senha do painel com proteção contra força bruta:
 * - 5 senhas erradas seguidas bloqueiam o IP por 30 minutos (bloqueado, nem confere a senha);
 * - teto diário de 30 tentativas por IP;
 * - teto somando todos os IPs, contra ataques distribuídos.
 * Se o banco falhar, o login fica bloqueado em vez de aceitar tentativas sem contar.
 */
export async function attemptAdminLogin(
  limiter: RateLimiter,
  ip: string,
  readPassword: () => Promise<string>,
  passwordHash: string,
): Promise<AdminLoginResult> {
  // O bloqueio do IP vem primeiro: um IP bloqueado insistindo não consome o teto de todos.
  const attempt = await limiter.beginAttempt(LOGIN_LOCKOUT, ip, { failClosed: true });
  if (!attempt.allowed) {
    return {
      ok: false,
      error: `Acesso bloqueado por excesso de tentativas. Tente de novo em ${minutes(attempt.retryAfterSeconds)}.`,
    };
  }
  const daily = await limiter.check(RATE_LIMITS.loginDaily, ip, { failClosed: true });
  if (!daily.allowed) {
    return {
      ok: false,
      error: `Limite de tentativas do dia atingido. Tente de novo em ${minutes(daily.retryAfterSeconds)}.`,
    };
  }
  const everyone = await limiter.beginAttempt(LOGIN_GLOBAL_LOCKOUT, EVERYONE, { failClosed: true });
  if (!everyone.allowed) {
    return {
      ok: false,
      error: `Login pausado por segurança (muitas tentativas). Tente de novo em ${minutes(everyone.retryAfterSeconds)}.`,
    };
  }

  const password = await readPassword();
  const ok = password.length > 0 && password.length <= 256 && (await verifyPassword(password, passwordHash));
  if (ok) {
    await limiter.clearAttempts(LOGIN_LOCKOUT, ip);
    await limiter.reset(RATE_LIMITS.loginDaily, ip);
    return { ok: true };
  }

  await limiter.recordFailure(LOGIN_GLOBAL_LOCKOUT, EVERYONE, everyone);
  if (await limiter.recordFailure(LOGIN_LOCKOUT, ip, attempt)) {
    return { ok: false, error: 'Senha incorreta. Por segurança, o acesso foi bloqueado por 30 minutos.' };
  }
  const left = attempt.remaining === 1 ? 'Resta 1 tentativa' : `Restam ${attempt.remaining} tentativas`;
  return { ok: false, error: `Senha incorreta. ${left} antes do bloqueio de 30 minutos.` };
}
