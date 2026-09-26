import type { APIRoute } from 'astro';
import { isVehicleImageKey } from '@/lib/storage/keys';
import { authenticateAdmin } from '@/server/admin-auth';
import { CACHE } from '@/server/security-headers';

/**
 * Entrega das fotos de veículos (storage privado -> site).
 * - Veículo publicado: qualquer visitante; chaves com UUID e conteúdo imutável -> cache de 1 ano.
 * - Rascunho/oculto: só administrador logado, sem cache compartilhado (fotos de clientes vindas de
 *   propostas não ficam acessíveis a quem descobrir o link).
 */
export const GET: APIRoute = async ({ params, locals, request, cookies }) => {
  const key = params.key ?? '';
  const notFound = () =>
    new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  if (!isVehicleImageKey(key)) return notFound();

  const { container } = locals;
  const vehicleId = key.split('/')[1] ?? '';
  const isPublic = await container.media.isVehiclePublic(vehicleId);
  // Foto de veículo ainda não publicado: 404 sem cache (ele pode ser publicado daqui a pouco).
  const privateNotFound = () =>
    new Response('Não encontrado', { status: 404, headers: { 'Cache-Control': CACHE.noStore } });
  if (!isPublic) {
    const admin = await authenticateAdmin(request, cookies, container.config, () =>
      container.settings.sessionsValidAfter(),
    );
    if (!admin) return privateNotFound();
  }

  const object = await container.media.getPublicVehicleObject(key);
  if (!object) return notFound();

  const headers = new Headers({
    'Content-Type': object.contentType,
    'Cache-Control': isPublic ? CACHE.immutable : CACHE.noStore,
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': isPublic ? 'cross-origin' : 'same-origin',
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
