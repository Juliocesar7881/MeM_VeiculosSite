import type { AstroGlobal } from 'astro';
import { countActiveFilters, parseInventoryFilters, type InventoryFilters } from '@/schemas/filters';

/** Abas do estoque: marcações do veículo (oferta / repasse), não categorias — um carro pode ter as duas. */
export type InventorySection = 'todos' | 'ofertas' | 'repasses';

/** Carrega a página única de estoque, com as abas Todos, Ofertas e Repasses. */
export async function loadInventoryPage(Astro: AstroGlobal) {
  const { container } = Astro.locals;
  const settings = await container.settings.get();
  const filters: InventoryFilters = parseInventoryFilters(Astro.url.searchParams);
  // Links antigos (?tipo=repasse) abrem a aba Repasses; as abas são exclusivas entre si.
  if (filters.commercialType === 'repasse') {
    filters.repasseOnly = true;
    delete filters.commercialType;
  }
  if (filters.repasseOnly) filters.offersOnly = false;
  if (filters.status === 'sold' && !settings.showSoldVehicles) delete filters.status;
  const section: InventorySection = filters.repasseOnly ? 'repasses' : filters.offersOnly ? 'ofertas' : 'todos';

  const [result, facets, counts] = await Promise.all([
    container.vehicles.search(filters, settings),
    container.vehicles.facets(filters, settings),
    container.vehicles.sectionCounts(filters, settings),
  ]);

  // Página além do fim: corrige para a última página existente.
  const redirectTo =
    result.total > 0 && filters.page > result.totalPages ? { ...filters, page: result.totalPages } : null;

  const sectionFlags = (filters.offersOnly ? 1 : 0) + (filters.repasseOnly ? 1 : 0);
  const filteredCount = countActiveFilters(filters) - sectionFlags + (filters.q ? 1 : 0);
  return { settings, filters, section, counts, result, facets, redirectTo, isFiltered: filteredCount > 0 };
}
