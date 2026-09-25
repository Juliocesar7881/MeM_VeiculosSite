import type { APIRoute } from 'astro';
import { absoluteUrl } from '@/lib/seo';

/**
 * /.well-known/security.txt (RFC 9116): diz a quem encontrar uma falha de segurança como avisar a empresa.
 * O prazo (Expires) é sempre 1 ano à frente, então o arquivo nunca "vence".
 */
export const GET: APIRoute = async ({ locals }) => {
  const { container, siteUrl } = locals;
  const settings = await container.settings.get();
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  expires.setUTCHours(0, 0, 0, 0);
  const lines = [
    ...(settings.email ? [`Contact: mailto:${settings.email}`] : []),
    `Contact: ${absoluteUrl(siteUrl, '/contato')}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: pt-BR, en',
    `Canonical: ${absoluteUrl(siteUrl, '/.well-known/security.txt')}`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
};
