import type { APIRoute } from 'astro';
import { isAppError } from '@/lib/errors';
import { vehicleQuickActionSchema, type VehicleQuickAction } from '@/schemas/vehicle';
import { flasher } from '@/server/flash';

const MESSAGES: Record<VehicleQuickAction, string> = {
  publish: 'Veículo publicado no site.',
  unpublish: 'Veículo tirado do site (voltou para rascunho).',
  'mark-available': 'Veículo marcado como disponível.',
  'mark-reserved': 'Veículo marcado como reservado.',
  'mark-sold': 'Veículo marcado como vendido.',
  archive: 'Veículo arquivado.',
  feature: 'Veículo destacado na Home.',
  unfeature: 'Destaque removido.',
  'offer-on': 'Veículo marcado como oferta.',
  'offer-off': 'Oferta removida.',
  'repasse-on': 'Veículo marcado como repasse.',
  'repasse-off': 'Repasse removido.',
  delete: 'Veículo excluído.',
};

function safeReturn(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === 'string' ? value : '';
  return path.startsWith('/admin') && !path.startsWith('//') ? path : fallback;
}

export const POST: APIRoute = async ({ params, request, locals }) => {
  const id = params.id ?? '';
  const form = await request.formData();
  const parsed = vehicleQuickActionSchema.safeParse(form.get('action'));
  const back = safeReturn(form.get('returnTo'), `/admin/veiculos/${id}`);
  const flash = flasher(locals.container.config);
  if (!parsed.success || !locals.admin) return flash.redirect(back, 'Ação inválida.', 'erro');

  try {
    await locals.container.vehicles.quickAction(id, parsed.data, locals.admin);
    const target = parsed.data === 'delete' && back.startsWith(`/admin/veiculos/${id}`) ? '/admin/veiculos' : back;
    return flash.redirect(target, MESSAGES[parsed.data]);
  } catch (error) {
    const message = isAppError(error) ? error.message : 'Não foi possível concluir a ação.';
    if (!isAppError(error)) console.error('[admin] ação de veículo', error);
    return flash.redirect(back, message, 'erro');
  }
};
