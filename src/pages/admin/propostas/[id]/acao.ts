import type { APIRoute } from 'astro';
import { LEAD_STATUS_LABELS } from '@/config/catalog';
import { isAppError } from '@/lib/errors';
import { leadNotesSchema, leadStatusSchema } from '@/schemas/lead';
import { flasher } from '@/server/flash';
import { formDataOrEmpty } from '@/server/http';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const id = params.id ?? '';
  const back = `/admin/propostas/${id}`;
  const { admin, container } = locals;
  const flash = flasher(container.config);
  if (!admin) return flash.redirect('/admin/login');
  const form = await formDataOrEmpty(request);
  const action = String(form.get('action') ?? '');

  try {
    switch (action) {
      case 'status': {
        const status = leadStatusSchema.safeParse(form.get('status'));
        if (!status.success) return flash.redirect(back, 'Status inválido.', 'erro');
        await container.leads.updateStatus(id, status.data, admin);
        return flash.redirect(back, `Status alterado para “${LEAD_STATUS_LABELS[status.data]}”.`);
      }
      case 'notes': {
        const parsed = leadNotesSchema.safeParse({ adminNotes: form.get('adminNotes') ?? '' });
        if (!parsed.success) return flash.redirect(back, 'Anotação muito longa.', 'erro');
        await container.leads.updateNotes(id, parsed.data.adminNotes, admin);
        return flash.redirect(back, 'Anotações salvas.');
      }
      case 'convert': {
        const vehicle = await container.leads.convertToVehicle(id, admin);
        return flash.redirect(
          `/admin/veiculos/${vehicle.id}`,
          'Rascunho criado a partir da proposta. Revise os dados, defina o preço e publique.',
        );
      }
      case 'delete': {
        await container.leads.delete(id, admin);
        return flash.redirect('/admin/propostas', 'Proposta e fotos excluídas definitivamente.');
      }
      default:
        return flash.redirect(back, 'Ação inválida.', 'erro');
    }
  } catch (error) {
    if (!isAppError(error)) console.error('[admin] ação de proposta', error);
    return flash.redirect(back, isAppError(error) ? error.message : 'Não foi possível concluir a ação.', 'erro');
  }
};
