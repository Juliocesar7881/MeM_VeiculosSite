import type { APIRoute } from 'astro';
import { CACHE } from '@/server/security-headers';

/**
 * Fotos das propostas (sell-leads/...): somente administradores autenticados.
 * O middleware já exige sessão em /api/admin/*; a verificação é repetida aqui
 * (defesa em profundidade) e a resposta nunca é cacheada por CDN.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.admin)
    return new Response('Não autorizado', { status: 401, headers: { 'Cache-Control': CACHE.noStore } });
  const object = await locals.container.media.getLeadObject(params.key ?? '');
  if (!object) return new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': CACHE.noStore } });
  return new Response(object.body as BodyInit, {
    headers: {
      'Content-Type': object.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
};
