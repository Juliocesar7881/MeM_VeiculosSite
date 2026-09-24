import type { APIRoute } from 'astro';
import { mediaUrl } from '@/lib/storage/keys';
import { CACHE } from '@/server/security-headers';

/**
 * Imagem de compartilhamento (Open Graph) do veículo: capa 1200×630 em JPEG com a marca.
 * WhatsApp/Facebook exibem JPEG com mais confiabilidade que WebP.
 * A URL contém o id da foto de capa -> conteúdo imutável (cache longo).
 *
 * Ordem: 1) JPEG gerado no navegador no upload (funciona em qualquer plataforma);
 *        2) geração no servidor com sharp (Node/Vercel);
 *        3) a própria foto WebP (fotos antigas no Cloudflare).
 */
export const GET: APIRoute = async ({ params, locals, redirect }) => {
  const { id = '', image = '' } = params;
  const uuid = /^[0-9a-f-]{36}$/;
  if (!uuid.test(id) || !uuid.test(image)) return new Response('Não encontrado', { status: 404 });

  const { container } = locals;
  const detail = await container.vehicles.getDetail(id);
  const cover = detail?.images.find((img) => img.id === image);
  if (!detail || !cover || !detail.published) return new Response('Não encontrado', { status: 404 });

  const headers = { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE.immutable };

  if (cover.ogKey) {
    const og = await container.media.getPublicVehicleObject(cover.ogKey);
    if (og) return new Response(og.body as BodyInit, { headers });
  }

  const render = container.platform.renderOgImage;
  if (render) {
    const object = await container.media.getPublicVehicleObject(cover.largeKey);
    if (!object) return new Response('Não encontrado', { status: 404 });
    try {
      return new Response((await render(object.body)) as BodyInit, { headers });
    } catch (error) {
      console.error('[og] falha ao gerar imagem', error);
    }
  }
  return redirect(mediaUrl(cover.largeKey), 302);
};
