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

/**
 * IP do cliente, usado apenas de forma anonimizada (hash) no limite de tentativas.
 *
 * Só confia no cabeçalho que a PRÓPRIA plataforma escreve (o visitante não consegue forjá-lo):
 *  - Cloudflare Workers: `CF-Connecting-IP` (a borda sobrescreve qualquer valor enviado);
 *  - Vercel: `X-Real-IP` / `X-Forwarded-For` (reescritos pela Vercel);
 *  - Node direto: o endereço da conexão (`clientAddress`). Cabeçalhos são ignorados, senão
 *    bastaria enviar um IP falso a cada tentativa para escapar do limite.
 */
export function clientIp(request: Request, socketAddress: string | undefined, platform: 'node' | 'cloudflare'): string {
  if (platform === 'cloudflare') {
    return request.headers.get('cf-connecting-ip') || socketAddress || 'unknown';
  }
  if (globalThis.process?.env?.VERCEL) {
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;
  }
  return socketAddress || 'unknown';
}

/** `Astro.clientAddress` lança erro quando o adaptador não conhece o IP; aqui vira `undefined`. */
export function socketAddressOf(context: { clientAddress: string }): string | undefined {
  try {
    return context.clientAddress;
  } catch {
    return undefined;
  }
}
