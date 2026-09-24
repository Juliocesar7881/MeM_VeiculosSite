/**
 * Cloudflare Turnstile — validação server-side do token.
 * https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

/** Chaves oficiais de TESTE da Cloudflare (sempre aprovam). Somente desenvolvimento. */
export const TURNSTILE_TEST_KEYS = {
  siteKey: '1x00000000000000000000AA',
  secretKey: '1x0000000000000000000000000000000AA',
} as const;

export interface TurnstileResult {
  success: boolean;
  errorCodes: string[];
  hostname?: string | undefined;
}

export async function verifyTurnstile(options: {
  secret: string;
  token: string | null | undefined;
  remoteIp?: string | undefined;
  idempotencyKey?: string | undefined;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileResult> {
  const token = options.token?.trim();
  if (!token) return { success: false, errorCodes: ['missing-input-response'] };
  if (token.length > 2048) return { success: false, errorCodes: ['invalid-input-response'] };

  const body = new FormData();
  body.append('secret', options.secret);
  body.append('response', token);
  if (options.remoteIp) body.append('remoteip', options.remoteIp);
  if (options.idempotencyKey) body.append('idempotency_key', options.idempotencyKey);

  const doFetch = options.fetchImpl ?? fetch;
  try {
    const res = await doFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as {
      success?: boolean;
      'error-codes'?: string[];
      hostname?: string;
    };
    return {
      success: data.success === true,
      errorCodes: data['error-codes'] ?? [],
      hostname: data.hostname,
    };
  } catch (error) {
    console.error('[turnstile] falha na verificação', error);
    return { success: false, errorCodes: ['internal-error'] };
  }
}
