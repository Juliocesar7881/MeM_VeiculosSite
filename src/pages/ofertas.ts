import type { APIRoute } from 'astro';

/** Ofertas agora é uma aba do estoque: redireciona (301) mantendo os filtros da URL antiga. */
export const GET: APIRoute = ({ url }) => {
  const params = new URLSearchParams(url.search);
  params.delete('oferta');
  params.delete('repasse');
  params.delete('tipo');
  const query = new URLSearchParams([['oferta', 'true'], ...params]).toString();
  return new Response(null, {
    status: 301,
    headers: { Location: `/estoque?${query}`, 'Cache-Control': 'public, max-age=86400' },
  });
};
