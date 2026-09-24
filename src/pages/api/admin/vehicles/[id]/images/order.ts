import type { APIRoute } from 'astro';
import { ValidationError } from '@/lib/errors';
import { imageOrderSchema } from '@/schemas/vehicle';
import { errorToResponse, json, jsonError } from '@/server/http';

/** Reordena as fotos. A primeira da lista vira a capa. */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  if (!locals.admin) return jsonError(401, 'Não autorizado.');
  try {
    if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
      return jsonError(415, 'Formato inválido.');
    }
    const parsed = imageOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ValidationError('Ordem de fotos inválida.');
    const images = await locals.container.media.reorderVehicleImages(params.id ?? '', parsed.data.order, locals.admin);
    return json({ ok: true, order: images.map((i) => i.id) });
  } catch (error) {
    return errorToResponse(error);
  }
};
