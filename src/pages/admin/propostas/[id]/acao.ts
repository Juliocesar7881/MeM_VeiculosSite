import type { APIRoute } from 'astro';
import { LEAD_STATUS_LABELS } from '@/config/catalog';
import { isAppError } from '@/lib/errors';
import { leadNotesSchema, leadStatusSchema } from '@/schemas/lead';
import { redirectWithFlash } from '@/server/http';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const id = params.id ?? '';
  const back = `/admin/propostas/${id}`;
  const { admin, container } = locals;
  if (!admin) return redirectWithFlash('/admin/login');
  const form = await request.formData();
  const action = String(form.get('action') ?? '');

  try {
    switch (action) {
      case 'status': {
        const status = leadStatusSchema.safeParse(form.get('status'));
        if (!status.success) return redirectWithFlash(back, 'Status inválido.', 'erro');
        await container.leads.updateStatus(id, status.data, admin);
        return redirectWithFlash(back, `Status alterado para “${LEAD_STATUS_LABELS[status.data]}”.`);
      }
      case 'notes': {
        const parsed = leadNotesSchema.safeParse({ adminNotes: form.get('adminNotes') ?? '' });
        if (!parsed.success) return redirectWithFlash(back, 'Anotação muito longa.', 'erro');
        await container.leads.updateNotes(id, parsed.data.adminNotes, admin);
        return redirectWithFlash(back, 'Anotações salvas.');
      }
      case 'convert': {
        const vehicle = await container.leads.convertToVehicle(id, admin);
        return redirectWithFlash(
          `/admin/veiculos/${vehicle.id}`,
          'Rascunho criado a partir da proposta. Revise os dados, defina o preço e publique.',
        );
      }
      case 'delete': {
        await container.leads.delete(id, admin);
        return redirectWithFlash('/admin/propostas', 'Proposta e fotos excluídas definitivamente.');
      }
      default:
        return redirectWithFlash(back, 'Ação inválida.', 'erro');
    }
  } catch (error) {
    if (!isAppError(error)) console.error('[admin] ação de proposta', error);
    return redirectWithFlash(back, isAppError(error) ? error.message : 'Não foi possível concluir a ação.', 'erro');
  }
};
