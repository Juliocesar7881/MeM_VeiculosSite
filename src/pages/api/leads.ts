import type { APIRoute } from 'astro';
import { IMAGE_LIMITS, SITE_CONSTANTS } from '@/config/site';
import { RateLimitError, ValidationError } from '@/lib/errors';
import { verifyTurnstile } from '@/lib/turnstile';
import { formDataToObject, toFieldErrors } from '@/schemas/common';
import { leadInputSchema } from '@/schemas/lead';
import type { ImagePair } from '@/services/media-service';
import { RATE_LIMITS } from '@/services/rate-limiter';
import {
  clientIp,
  contentLength,
  errorToResponse,
  fileBytes,
  json,
  jsonError,
  readFormData,
  socketAddressOf,
} from '@/server/http';

/**
 * Recebe propostas do formulário "Anuncie seu veículo".
 * Camadas anti-spam: tamanho da requisição, rate limit por IP (hash), honeypot,
 * Cloudflare Turnstile e validação completa no servidor.
 */
export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const { container } = locals;
  try {
    // O tamanho declarado é obrigatório (o navegador sempre envia): sem ele, ler o corpo não teria limite.
    const length = contentLength(request);
    if (length === null) return jsonError(411, 'Envio inválido. Atualize a página e tente novamente.');
    if (length > IMAGE_LIMITS.leadRequestMaxBytes) {
      return jsonError(413, 'As fotos ficaram grandes demais. Remova algumas e tente novamente.');
    }
    const type = request.headers.get('content-type') ?? '';
    if (!type.startsWith('multipart/form-data')) return jsonError(415, 'Formato de envio inválido.');

    const ip = clientIp(request, socketAddressOf(context), container.platform.name);
    for (const rule of [RATE_LIMITS.leadHourly, RATE_LIMITS.leadDaily]) {
      const limit = await container.rateLimiter.check(rule, ip);
      if (!limit.allowed) {
        throw new RateLimitError(
          'Recebemos muitos envios da sua conexão. Tente novamente mais tarde ou fale pelo WhatsApp.',
          limit.retryAfterSeconds,
        );
      }
    }

    const form = await readFormData(request);

    // Honeypot preenchido: responde "ok" sem gravar nada (não dá pistas ao robô).
    if (String(form.get('website') ?? '').trim() !== '') return json({ ok: true });

    const { turnstile } = container.config;
    if (!turnstile.configured) {
      return jsonError(503, 'O envio está temporariamente indisponível. Fale com a gente pelo WhatsApp.');
    }
    const captcha = await verifyTurnstile({
      secret: turnstile.secretKey,
      token: String(form.get('cf-turnstile-response') ?? ''),
      remoteIp: ip === 'unknown' ? undefined : ip,
    });
    // O desafio precisa ter sido resolvido neste site (e não num token reaproveitado de outro lugar).
    const solvedHere =
      turnstile.usingTestKeys || !captcha.hostname || captcha.hostname === new URL(request.url).hostname;
    if (!captcha.success || !solvedHere) {
      return jsonError(400, 'Não foi possível confirmar que você não é um robô. Tente novamente.');
    }

    const parsed = leadInputSchema.safeParse(formDataToObject(form));
    if (!parsed.success) {
      throw new ValidationError('Revise os campos destacados.', toFieldErrors(parsed.error));
    }

    const photos: ImagePair[] = [];
    for (let i = 0; i < SITE_CONSTANTS.maxLeadPhotos + 1; i += 1) {
      const large = await fileBytes(form.get(`photo_large_${i}`));
      const thumb = await fileBytes(form.get(`photo_thumb_${i}`));
      if (!large && !thumb) continue;
      if (!large || !thumb) throw new ValidationError('Uma das fotos chegou incompleta. Envie novamente.');
      photos.push({ large, thumb });
    }

    const ipHash = await container.rateLimiter.hashIdentifier(ip);
    await container.leads.submit(parsed.data, photos, { ipHash: ipHash.slice(0, 32) });
    return json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorToResponse(error);
  }
};

export const ALL: APIRoute = () => jsonError(405, 'Método não permitido.');
