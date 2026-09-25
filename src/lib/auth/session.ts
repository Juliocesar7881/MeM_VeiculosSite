import { fromBase64Url, timingSafeEqual, toBase64Url } from './password';

/**
 * Sessão do painel em cookie assinado (HMAC-SHA256), sem estado no servidor.
 * A chave de assinatura deriva de SESSION_SECRET + hash da senha: trocar a senha
 * (ou o segredo) invalida imediatamente todas as sessões abertas.
 */
export const SESSION_COOKIE = 'mm_admin';
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

async function hmacKey(secret: string, binding: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${secret}::${binding}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(data: string, key: CryptoKey): Promise<Uint8Array> {
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

export async function createSessionToken(
  secret: string,
  binding: string,
  subject = 'admin',
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = { sub: subject, iat: nowSeconds, exp: nowSeconds + SESSION_TTL_SECONDS };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, binding);
  return `${encoded}.${toBase64Url(await sign(encoded, key))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  binding: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<SessionPayload | null> {
  if (!token || token.length > 1024) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const key = await hmacKey(secret, binding);
    const expected = await sign(encoded, key);
    if (!timingSafeEqual(expected, fromBase64Url(signature))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) return null;
    if (typeof payload.iat !== 'number') return null;
    if (typeof payload.sub !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
