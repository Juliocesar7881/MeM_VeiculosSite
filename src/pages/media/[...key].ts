import type { APIRoute } from 'astro';
import { CACHE } from '@/server/security-headers';

/**
 * Entrega das fotos de veículos publicadas (storage privado -> site).
 * As chaves contêm UUIDs e nunca mudam de conteúdo: cache de 1 ano no navegador e na CDN.
 */
export const GET: APIRoute = async ({ params, locals, request }) => {
  const key = params.key ?? '';
  const object = await locals.container.media.getPublicVehicleObject(key);
  if (!object) {
    return new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  }

  const headers = new Headers({
    'Content-Type': object.contentType,
    'Cache-Control': CACHE.immutable,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  if (object.etag) {
    headers.set('ETag', object.etag);
    if (request.headers.get('if-none-match') === object.etag) {
      return new Response(null, { status: 304, headers });
    }
  }
  if (object.size) headers.set('Content-Length', String(object.size));
  return new Response(object.body as BodyInit, { status: 200, headers });
};
