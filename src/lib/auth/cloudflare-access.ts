import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * Validação do Cloudflare Access (Zero Trust).
 * Mesmo com o Access protegendo /admin/* na borda, o backend confere o JWT
 * (header Cf-Access-Jwt-Assertion) — não confiamos apenas em "esconder o link".
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwks(teamDomain: string) {
  const base = teamDomain.replace(/\/+$/, '');
  let set = jwksCache.get(base);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${base}/cdn-cgi/access/certs`));
    jwksCache.set(base, set);
  }
  return set;
}

export interface AccessIdentity {
  email: string;
}

export async function verifyCloudflareAccess(
  request: Request,
  options: { teamDomain: string; audience: string; allowedEmails: string[] },
): Promise<AccessIdentity | null> {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  try {
    const base = options.teamDomain.replace(/\/+$/, '');
    const { payload } = await jwtVerify(token, jwks(base), {
      issuer: base,
      audience: options.audience,
    });
    const email = (payload as JWTPayload & { email?: unknown }).email;
    if (typeof email !== 'string') return null;
    if (options.allowedEmails.length && !options.allowedEmails.includes(email.toLowerCase())) return null;
    return { email };
  } catch {
    return null;
  }
}
