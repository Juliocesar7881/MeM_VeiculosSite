import type { APIRoute } from 'astro';

/** Repasses agora é uma aba da página de veículos: redireciona (301) mantendo os filtros da URL antiga. */
export const GET: APIRoute = ({ url }) => {
  const params = new URLSearchParams(url.search);
  params.delete('oferta');
  params.delete('repasse');
  params.delete('tipo');
  const query = new URLSearchParams([['repasse', 'true'], ...params]).toString();
  return new Response(null, {
    status: 301,
    headers: { Location: `/veiculos?${query}`, 'Cache-Control': 'public, max-age=86400' },
  });
};
