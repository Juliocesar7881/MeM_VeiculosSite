import type { LeadDetail } from '@/types/domain';
import { CATEGORY_INFO } from '@/config/catalog';
import { formatBRL } from '@/utils/money';
import { formatBrazilPhone } from '@/utils/phone';
import { vehicleTitleWithYear } from '@/utils/vehicle-format';
import type { LeadNotifier } from './lead-service';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Aviso opcional por e-mail (Resend) quando chega uma nova proposta.
 * O e-mail NÃO contém fotos nem dados além do necessário; o detalhe completo fica no painel.
 */
export class ResendLeadNotifier implements LeadNotifier {
  constructor(private readonly options: { apiKey: string; to: string; from: string; siteUrl: string }) {}

  async notifyNewLead(lead: LeadDetail): Promise<void> {
    const title = vehicleTitleWithYear(lead);
    const adminUrl = `${this.options.siteUrl.replace(/\/$/, '')}/admin/propostas/${lead.id}`;
    const rows: [string, string][] = [
      ['Veículo', title],
      ['Categoria', CATEGORY_INFO[lead.category].label],
      ['Cliente', lead.name],
      ['WhatsApp', formatBrazilPhone(lead.whatsapp)],
      ['Preço pretendido', lead.desiredPrice ? formatBRL(lead.desiredPrice) : 'Não informado'],
      ['Fotos', String(lead.images.length)],
    ];
    const html = `<h2>Nova proposta recebida pelo site</h2>
<table cellpadding="6">${rows
      .map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(v)}</td></tr>`)
      .join('')}</table>
<p><a href="${escapeHtml(adminUrl)}">Abrir proposta no painel</a></p>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.options.from,
        to: [this.options.to],
        subject: `Nova proposta: ${title}`,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Resend respondeu ${res.status}`);
  }
}
