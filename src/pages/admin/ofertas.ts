import type { APIRoute } from 'astro';

/** Ofertas no painel = listagem de veículos com filtro (sem duplicar lógica). */
export const GET: APIRoute = ({ redirect }) => redirect('/admin/veiculos?filtro=ofertas', 302);
