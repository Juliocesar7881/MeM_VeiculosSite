import type { APIRoute } from 'astro';

/** Repasses no painel = listagem de veículos com filtro (sem duplicar lógica). */
export const GET: APIRoute = ({ redirect }) => redirect('/admin/veiculos?filtro=repasses', 302);
