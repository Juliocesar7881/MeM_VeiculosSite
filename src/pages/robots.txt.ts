import type { APIRoute } from 'astro';
import { CACHE } from '@/server/security-headers';

/**
 * robots.txt dinâmico: enquanto ALLOW_INDEXING=false (desenvolvimento, preview, validação
 * com o cliente), bloqueia buscadores. Em produção no domínio definitivo, libera o site público.
 */
export const GET: APIRoute = ({ locals }) => {
  const { container, siteUrl } = locals;
  const body = container.config.allowIndexing
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /favoritos',
        '',
        `Sitemap: ${siteUrl}/sitemap.xml`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': CACHE.shortPublic },
  });
};
