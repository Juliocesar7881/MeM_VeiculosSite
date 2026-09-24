import type { APIRoute } from 'astro';
import { IMAGE_LIMITS } from '@/config/site';
import { ValidationError } from '@/lib/errors';
import { mediaUrl } from '@/lib/storage/keys';
import { contentLength, errorToResponse, fileBytes, json, jsonError } from '@/server/http';

/** Upload de UMA foto (grande + média + miniatura + compartilhamento, já geradas no navegador). */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.admin) return jsonError(401, 'Não autorizado.');
  try {
    const length = contentLength(request);
    if (length !== null && length > IMAGE_LIMITS.vehicleRequestMaxBytes) {
      return jsonError(413, 'Foto muito grande após a compressão.');
    }
    const form = await request.formData();
    const large = await fileBytes(form.get('large'));
    const thumb = await fileBytes(form.get('thumb'));
    const medium = await fileBytes(form.get('medium'));
    const og = await fileBytes(form.get('og'));
    if (!large || !thumb) throw new ValidationError('Envie a foto e a miniatura.');
    const image = await locals.container.media.addVehicleImage(
      params.id ?? '',
      { large, thumb, medium, og },
      locals.admin,
    );
    return json(
      {
        ok: true,
        image: {
          id: image.id,
          position: image.position,
          thumbUrl: mediaUrl(image.thumbKey),
          largeUrl: mediaUrl(image.largeKey),
          thumbWidth: image.thumbWidth,
          thumbHeight: image.thumbHeight,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorToResponse(error);
  }
};
