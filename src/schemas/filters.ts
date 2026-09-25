import {
  categoryFromSlug,
  CATEGORY_INFO,
  COMMERCIAL_TYPES,
  FUELS,
  PUBLIC_STATUS_SLUGS,
  PUBLIC_STATUSES,
  SORT_OPTIONS,
  TRANSMISSIONS,
  type CommercialType,
  type Fuel,
  type PublicStatus,
  type SortOption,
  type Transmission,
  type VehicleCategory,
} from '@/config/catalog';

/**
 * Filtros do estoque público. Os parâmetros ficam na query string em português:
 * /veiculos?marca=Toyota&categoria=carros&oferta=true&ordem=menor-preco&pagina=2
 */
export interface InventoryFilters {
  q?: string;
  category?: VehicleCategory;
  brand?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  /** Em reais (inteiro). */
  priceMin?: number;
  priceMax?: number;
  fuel?: Fuel;
  transmission?: Transmission;
  commercialType?: CommercialType;
  status?: PublicStatus;
  offersOnly: boolean;
  repasseOnly: boolean;
  sort: SortOption;
  page: number;
}

export const DEFAULT_FILTERS: InventoryFilters = {
  offersOnly: false,
  repasseOnly: false,
  sort: 'recentes',
  page: 1,
};

function cleanString(value: string | null, max: number): string | undefined {
  if (!value) return undefined;
  // Remove caracteres de controle e sinais de tag (defesa extra; o Astro já escapa a saída).
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

function intParam(value: string | null, min: number, max: number): number | undefined {
  if (!value) return undefined;
  const digits = value.replace(/[.\s]/g, '');
  if (!/^\d+$/.test(digits)) return undefined;
  const n = Number(digits);
  return n >= min && n <= max ? n : undefined;
}

function boolParam(value: string | null): boolean {
  return value === 'true' || value === '1' || value === 'sim' || value === 'on';
}

function enumParam<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase() as T;
  return values.includes(lower) ? lower : undefined;
}

function statusParam(value: string | null): PublicStatus | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  return PUBLIC_STATUSES.find((s) => PUBLIC_STATUS_SLUGS[s] === v || s === v);
}

/** Lê filtros da URL de forma tolerante: valores inválidos são ignorados. */
export function parseInventoryFilters(params: URLSearchParams): InventoryFilters {
  const filters: InventoryFilters = {
    offersOnly: boolParam(params.get('oferta')),
    repasseOnly: boolParam(params.get('repasse')),
    sort: enumParam(params.get('ordem'), SORT_OPTIONS) ?? 'recentes',
    page: intParam(params.get('pagina'), 1, 10_000) ?? 1,
  };

  const q = cleanString(params.get('q'), 80);
  if (q) filters.q = q;
  const category = categoryFromSlug(params.get('categoria'));
  if (category) filters.category = category;
  const brand = cleanString(params.get('marca'), 40);
  if (brand) filters.brand = brand;
  const model = cleanString(params.get('modelo'), 60);
  if (model) filters.model = model;

  let yearMin = intParam(params.get('ano_min'), 1900, 2100);
  let yearMax = intParam(params.get('ano_max'), 1900, 2100);
  if (yearMin && yearMax && yearMin > yearMax) [yearMin, yearMax] = [yearMax, yearMin];
  if (yearMin) filters.yearMin = yearMin;
  if (yearMax) filters.yearMax = yearMax;

  let priceMin = intParam(params.get('preco_min'), 0, 100_000_000);
  let priceMax = intParam(params.get('preco_max'), 0, 100_000_000);
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }
  if (priceMin) filters.priceMin = priceMin;
  if (priceMax) filters.priceMax = priceMax;

  const fuel = enumParam(params.get('combustivel'), FUELS);
  if (fuel) filters.fuel = fuel;
  const transmission = enumParam(params.get('cambio'), TRANSMISSIONS);
  if (transmission) filters.transmission = transmission;
  const commercialType = enumParam(params.get('tipo'), COMMERCIAL_TYPES);
  if (commercialType) filters.commercialType = commercialType;
  const status = statusParam(params.get('status'));
  if (status) filters.status = status;

  return filters;
}

/** Serializa filtros de volta para query string (omitindo padrões). */
export function filtersToSearchParams(
  filters: Partial<InventoryFilters>,
  overrides: Partial<InventoryFilters> = {},
): URLSearchParams {
  const f = { ...DEFAULT_FILTERS, ...filters, ...overrides };
  const params = new URLSearchParams();
  if (f.q) params.set('q', f.q);
  if (f.category) params.set('categoria', CATEGORY_INFO[f.category].slug);
  if (f.brand) params.set('marca', f.brand);
  if (f.model) params.set('modelo', f.model);
  if (f.yearMin) params.set('ano_min', String(f.yearMin));
  if (f.yearMax) params.set('ano_max', String(f.yearMax));
  if (f.priceMin) params.set('preco_min', String(f.priceMin));
  if (f.priceMax) params.set('preco_max', String(f.priceMax));
  if (f.fuel) params.set('combustivel', f.fuel);
  if (f.transmission) params.set('cambio', f.transmission);
  if (f.commercialType) params.set('tipo', f.commercialType);
  if (f.status) params.set('status', PUBLIC_STATUS_SLUGS[f.status]);
  if (f.offersOnly) params.set('oferta', 'true');
  if (f.repasseOnly) params.set('repasse', 'true');
  if (f.sort && f.sort !== 'recentes') params.set('ordem', f.sort);
  if (f.page && f.page > 1) params.set('pagina', String(f.page));
  return params;
}

export function inventoryHref(
  filters: Partial<InventoryFilters>,
  overrides: Partial<InventoryFilters> = {},
  basePath = '/veiculos',
): string {
  const qs = filtersToSearchParams(filters, overrides).toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Quantidade de filtros ativos (para o botão "Filtros (3)" no mobile). */
export function countActiveFilters(f: InventoryFilters): number {
  let count = 0;
  const keys: (keyof InventoryFilters)[] = [
    'category',
    'brand',
    'model',
    'yearMin',
    'yearMax',
    'priceMin',
    'priceMax',
    'fuel',
    'transmission',
    'commercialType',
    'status',
  ];
  for (const key of keys) if (f[key] !== undefined) count += 1;
  if (f.offersOnly) count += 1;
  if (f.repasseOnly) count += 1;
  return count;
}
