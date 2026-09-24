import type { APIRoute } from 'astro';
import { jsonError } from '@/server/http';

const MAX_BODY = 512;

/**
 * Métricas anônimas enviadas pela página do veículo (navigator.sendBeacon):
 * `{ "v": "<id do veículo>", "e": "view" | "whatsapp" }`.
 * Sem cookies e sem IP. Responde sempre 204 — não revela se o veículo existe.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const text = await request.text();
    if (text.length <= MAX_BODY) {
      const body = JSON.parse(text) as { v?: unknown; e?: unknown };
      if (typeof body.v === 'string' && (body.e === 'view' || body.e === 'whatsapp')) {
        await locals.container.stats.record(body.v, body.e);
      }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) console.error('[metrics] falha ao registrar', error);
  }
  return new Response(null, { status: 204 });
};

export const ALL: APIRoute = () => jsonError(405, 'Método não permitido.');
