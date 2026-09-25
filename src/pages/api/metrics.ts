import type { APIRoute } from 'astro';
import { clientIp, contentLength, jsonError, socketAddressOf } from '@/server/http';

const MAX_BODY = 512;

/**
 * Proteção da cota de escrita do banco (D1 grátis: 100 mil gravações/dia) contra robôs:
 *  - o mesmo visitante conta no máximo 1 vez a cada 30 min por veículo e evento;
 *  - cada instância grava no máximo 300 métricas por minuto.
 * Tudo em memória e temporário: o IP nunca é gravado.
 */
const DEDUPE_MS = 30 * 60 * 1000;
const MAX_TRACKED = 10_000;
const MAX_WRITES_PER_MINUTE = 300;
const lastSeen = new Map<string, number>();
let minuteStart = 0;
let writesThisMinute = 0;

function shouldRecord(key: string, now: number): boolean {
  if (now - minuteStart >= 60_000) {
    minuteStart = now;
    writesThisMinute = 0;
  }
  if (writesThisMinute >= MAX_WRITES_PER_MINUTE) return false;
  const last = lastSeen.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return false;
  if (last === undefined && lastSeen.size >= MAX_TRACKED) {
    const oldest = lastSeen.keys().next().value;
    if (oldest !== undefined) lastSeen.delete(oldest);
  }
  lastSeen.delete(key);
  lastSeen.set(key, now);
  writesThisMinute += 1;
  return true;
}

/**
 * Métricas anônimas enviadas pela página do veículo (navigator.sendBeacon):
 * `{ "v": "<id do veículo>", "e": "view" | "whatsapp" }`.
 * Sem cookies. Responde sempre 204 — não revela se o veículo existe.
 */
export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  const noContent = new Response(null, { status: 204 });
  const length = contentLength(request);
  if (length === null || length > MAX_BODY) return noContent;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return noContent;
    const body = JSON.parse(text) as { v?: unknown; e?: unknown };
    if (typeof body.v !== 'string' || (body.e !== 'view' && body.e !== 'whatsapp')) return noContent;
    const ip = clientIp(request, socketAddressOf(context), locals.container.platform.name);
    if (shouldRecord(`${ip}|${body.v}|${body.e}`, Date.now())) {
      await locals.container.stats.record(body.v, body.e);
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) console.error('[metrics] falha ao registrar', error);
  }
  return noContent;
};

export const ALL: APIRoute = () => jsonError(405, 'Método não permitido.');
