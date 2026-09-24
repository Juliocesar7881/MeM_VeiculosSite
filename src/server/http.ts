import { isAppError, ValidationError } from '@/lib/errors';
import { CACHE } from './security-headers';

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', CACHE.noStore);
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: message, ...extra }, { status });
}

/** Converte exceções em resposta JSON sem vazar detalhes internos. */
export function errorToResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return jsonError(error.status, error.message, { fieldErrors: error.fieldErrors });
  }
  if (isAppError(error)) {
    const headers: Record<string, string> = {};
    if ('retryAfterSeconds' in error && typeof error.retryAfterSeconds === 'number') {
      headers['Retry-After'] = String(error.retryAfterSeconds);
    }
    return json({ ok: false, error: error.message }, { status: error.status, headers });
  }
  console.error('[api] erro inesperado', error);
  return jsonError(500, 'Não foi possível concluir a operação. Tente novamente.');
}

/** Redirect 303 (Post/Redirect/Get) com mensagem opcional na query string. */
export function redirectWithFlash(location: string, flash?: string, kind: 'ok' | 'erro' = 'ok'): Response {
  let target = location;
  if (flash) {
    const sep = location.includes('?') ? '&' : '?';
    target = `${location}${sep}${kind}=${encodeURIComponent(flash)}`;
  }
  return new Response(null, { status: 303, headers: { Location: target, 'Cache-Control': CACHE.noStore } });
}

/** Lê o corpo como Uint8Array a partir de um File do FormData. */
export async function fileBytes(value: FormDataEntryValue | null): Promise<Uint8Array | null> {
  if (!value || typeof value === 'string') return null;
  const buffer = await value.arrayBuffer();
  return new Uint8Array(buffer);
}

export function contentLength(request: Request): number | null {
  const header = request.headers.get('content-length');
  if (!header) return null;
  const n = Number(header);
  return Number.isFinite(n) ? n : null;
}

/** IP do cliente (Vercel/Cloudflare/local). Usado apenas de forma anonimizada (hash). */
export function clientIp(request: Request, fallback: string | undefined): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return fallback ?? 'unknown';
}
