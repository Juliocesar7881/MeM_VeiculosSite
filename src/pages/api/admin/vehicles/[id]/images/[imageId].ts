import type { APIRoute } from 'astro';
import { errorToResponse, json, jsonError } from '@/server/http';

export const DELETE: APIRoute = async ({ params, locals }) => {
  if (!locals.admin) return jsonError(401, 'Não autorizado.');
  try {
    await locals.container.media.deleteVehicleImage(params.id ?? '', params.imageId ?? '', locals.admin);
    return json({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
};
