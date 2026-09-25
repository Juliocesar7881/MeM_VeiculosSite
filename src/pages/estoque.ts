import type { APIRoute } from 'astro';

/** A listagem passou a se chamar "Veículos" (/veiculos): redireciona (301) mantendo os filtros. */
export const GET: APIRoute = ({ url }) =>
  new Response(null, {
    status: 301,
    headers: { Location: `/veiculos${url.search}`, 'Cache-Control': 'public, max-age=86400' },
  });
