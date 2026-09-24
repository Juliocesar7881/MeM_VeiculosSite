import type { APIRoute } from 'astro';
import { mediaUrl } from '@/lib/storage/keys';
import { CACHE } from '@/server/security-headers';
import { renderOgImage } from '@/server/og-image';

/**
 * Imagem de compartilhamento (Open Graph) do veículo: capa 1200×630 em JPEG com a marca.
 * WhatsApp/Facebook exibem JPEG com mais confiabilidade que WebP.
 * A URL contém o id da foto de capa -> conteúdo imutável (cache longo).
 */
export const GET: APIRoute = async ({ params, locals, redirect }) => {
  const { id = '', image = '' } = params;
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(id) || !uuid.test(image)) return new Response('Não encontrado', { status: 404 });

  const detail = await locals.container.vehicles.getDetail(id);
  const cover = detail?.images.find((img) => img.id === image);
  if (!detail || !cover || !detail.published) return new Response('Não encontrado', { status: 404 });

  const object = await locals.container.media.getPublicVehicleObject(cover.largeKey);
  if (!object) return new Response('Não encontrado', { status: 404 });

  try {
    const jpeg = await renderOgImage(object.body);
    return new Response(jpeg as BodyInit, {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE.immutable },
    });
  } catch (error) {
    // Ambiente sem sharp (ex.: runtime edge): usa a própria foto WebP.
    console.error('[og] falha ao gerar imagem', error);
    return redirect(mediaUrl(cover.largeKey), 302);
  }
};
