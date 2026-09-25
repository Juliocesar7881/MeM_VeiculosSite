import { fromBase64Url, timingSafeEqual, toBase64Url } from '@/lib/auth/password';
import type { ServerConfig } from './config';
import { CACHE } from './security-headers';

/**
 * Avisos do painel ("Alterações salvas.", erros...) passados pela URL (?ok= / ?erro=) e ASSINADOS
 * com uma chave do servidor (&fs=). O painel só exibe avisos com assinatura válida: um link de
 * terceiros com um texto falso ("Veículo excluído", "Ligue para...") é simplesmente ignorado.
 */
export type FlashKind = 'ok' | 'erro';

const SIGNATURE_PARAM = 'fs';
const MAX_MESSAGE_LENGTH = 500;

/** Chave usada nas assinaturas: só existe no servidor. */
export function flashSecret(config: ServerConfig): string {
  return config.auth.sessionSecret || config.ipHashSalt;
}

async function signature(kind: FlashKind, message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`flash::${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${kind}\n${message}`));
  return new Uint8Array(mac).slice(0, 16);
}

/** Caminho com o aviso assinado, preservando a âncora: `/admin/x?ok=Salvo&fs=...#fotos`. */
export async function flashUrl(location: string, message: string, kind: FlashKind, secret: string): Promise<string> {
  const hashIndex = location.indexOf('#');
  const path = hashIndex === -1 ? location : location.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : location.slice(hashIndex);
  const sig = toBase64Url(await signature(kind, message, secret));
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${kind}=${encodeURIComponent(message)}&${SIGNATURE_PARAM}=${sig}${hash}`;
}

/** Lê o aviso da URL; sem assinatura válida, retorna null. */
export async function readFlash(url: URL, secret: string): Promise<{ kind: FlashKind; message: string } | null> {
  const provided = url.searchParams.get(SIGNATURE_PARAM);
  if (!provided) return null;
  let providedBytes: Uint8Array;
  try {
    providedBytes = fromBase64Url(provided);
  } catch {
    return null;
  }
  for (const kind of ['erro', 'ok'] as const) {
    const message = url.searchParams.get(kind);
    if (!message || message.length > MAX_MESSAGE_LENGTH) continue;
    if (timingSafeEqual(await signature(kind, message, secret), providedBytes)) return { kind, message };
  }
  return null;
}

/** Atalhos para as rotas do painel: `const flash = flasher(config); return flash.redirect(back, 'Salvo.');` */
export function flasher(config: ServerConfig) {
  const secret = flashSecret(config);
  return {
    url: (location: string, message: string, kind: FlashKind = 'ok') => flashUrl(location, message, kind, secret),
    /** Redirect 303 (Post/Redirect/Get) com aviso assinado opcional. */
    redirect: async (location: string, message?: string, kind: FlashKind = 'ok') =>
      new Response(null, {
        status: 303,
        headers: {
          Location: message ? await flashUrl(location, message, kind, secret) : location,
          'Cache-Control': CACHE.noStore,
        },
      }),
  };
}
