import type { AstroCookies } from 'astro';
import { verifyCloudflareAccess } from '@/lib/auth/cloudflare-access';
import { isValidPasswordHash } from '@/lib/auth/password';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from '@/lib/auth/session';
import type { AdminActor } from '@/types/domain';
import type { ServerConfig } from './config';

export type AuthProblem = 'missing-password-config' | 'missing-access-config' | null;

/** Diagnóstico de configuração (mostrado na tela de login quando algo falta). */
export function authConfigProblem(config: ServerConfig): AuthProblem {
  if (config.auth.mode === 'cloudflare-access') {
    return config.auth.accessTeamDomain && config.auth.accessAudience ? null : 'missing-access-config';
  }
  const secretOk = (config.auth.sessionSecret?.length ?? 0) >= 32;
  return isValidPasswordHash(config.auth.passwordHash) && secretOk ? null : 'missing-password-config';
}

/**
 * @param sessionsValidAfter corte de sessões (segundos Unix) gravado pelo "Sair". Só é consultado
 *   quando o cookie já tem assinatura válida; se a leitura falhar, o acesso é negado.
 */
export async function authenticateAdmin(
  request: Request,
  cookies: AstroCookies,
  config: ServerConfig,
  sessionsValidAfter: () => Promise<number> = async () => 0,
): Promise<AdminActor | null> {
  if (config.auth.mode === 'cloudflare-access') {
    if (!config.auth.accessTeamDomain || !config.auth.accessAudience) return null;
    const identity = await verifyCloudflareAccess(request, {
      teamDomain: config.auth.accessTeamDomain,
      audience: config.auth.accessAudience,
      allowedEmails: config.auth.allowedEmails,
    });
    return identity ? { id: identity.email, label: identity.email, method: 'cloudflare-access' } : null;
  }

  if (authConfigProblem(config)) return null;
  const token = cookies.get(SESSION_COOKIE)?.value;
  const secret = config.auth.sessionSecret as string;
  const binding = config.auth.passwordHash as string;
  const payload = await verifySessionToken(token, secret, binding);
  if (!payload) return null;
  try {
    // Sessão emitida antes do último "Sair" foi encerrada no servidor.
    if (payload.iat <= (await sessionsValidAfter())) return null;
  } catch (error) {
    console.error('[auth] falha ao ler o corte de sessões; acesso negado', error);
    return null;
  }
  return { id: payload.sub, label: 'Administrador', method: 'password' };
}

export async function startAdminSession(cookies: AstroCookies, config: ServerConfig, secure: boolean) {
  const token = await createSessionToken(config.auth.sessionSecret as string, config.auth.passwordHash as string);
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function endAdminSession(cookies: AstroCookies, secure: boolean) {
  cookies.delete(SESSION_COOKIE, { path: '/', httpOnly: true, secure, sameSite: 'strict' });
}

/** Evita open redirect: só aceita caminhos internos do painel. */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (!next || !next.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) return '/admin';
  if (next.startsWith('/admin/login')) return '/admin';
  return next;
}
