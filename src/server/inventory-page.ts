import type { AstroGlobal } from 'astro';
import { countActiveFilters, parseInventoryFilters, type InventoryFilters } from '@/schemas/filters';

/**
 * Carrega os dados de uma página de listagem (estoque, ofertas, repasses).
 * O filtro "travado" da página é aplicado no servidor, independentemente da URL.
 */
export async function loadInventoryPage(Astro: AstroGlobal, locked?: 'offers' | 'repasses') {
  const { container } = Astro.locals;
  const settings = await container.settings.get();
  const filters: InventoryFilters = parseInventoryFilters(Astro.url.searchParams);
  if (locked === 'offers') filters.offersOnly = true;
  if (locked === 'repasses') {
    filters.repasseOnly = true;
    delete filters.commercialType;
  }
  if (filters.status === 'sold' && !settings.showSoldVehicles) delete filters.status;

  const [result, facets] = await Promise.all([
    container.vehicles.search(filters, settings),
    container.vehicles.facets(filters, settings),
  ]);

  // Página além do fim: corrige para a última página existente.
  const redirectTo =
    result.total > 0 && filters.page > result.totalPages ? { ...filters, page: result.totalPages } : null;

  const filteredCount = countActiveFilters(filters) - (locked ? 1 : 0) + (filters.q ? 1 : 0);
  return { settings, filters, result, facets, redirectTo, isFiltered: filteredCount > 0 };
}
