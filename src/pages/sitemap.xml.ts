import type { APIRoute } from 'astro';
import { CACHE } from '@/server/security-headers';

const STATIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/estoque', priority: '0.9', changefreq: 'daily' },
  { path: '/estoque?oferta=true', priority: '0.8', changefreq: 'daily' },
  { path: '/estoque?repasse=true', priority: '0.7', changefreq: 'daily' },
  { path: '/anuncie-seu-veiculo', priority: '0.7', changefreq: 'monthly' },
  { path: '/empresa', priority: '0.5', changefreq: 'monthly' },
  { path: '/contato', priority: '0.5', changefreq: 'monthly' },
  { path: '/politica-de-privacidade', priority: '0.2', changefreq: 'yearly' },
];

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const GET: APIRoute = async ({ locals }) => {
  const { container, siteUrl } = locals;
  const settings = await container.settings.get();
  const vehicles = await container.vehicles.listForSitemap(settings);

  const urls = [
    ...STATIC_PATHS.map(
      (p) =>
        `<url><loc>${escapeXml(siteUrl + (p.path === '/' ? '/' : p.path))}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
    ),
    ...vehicles.map(
      (v) =>
        `<url><loc>${escapeXml(`${siteUrl}/veiculo/${v.slug}`)}</loc><lastmod>${escapeXml(v.updatedAt.slice(0, 10))}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': CACHE.shortPublic },
  });
};
