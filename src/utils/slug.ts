import { stripDiacritics } from './text';

const MAX_SLUG_BASE = 80;

/** Converte texto livre em slug URL-safe: "Corolla XEi 2.0" -> "corolla-xei-2-0". */
export function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_BASE)
    .replace(/-+$/g, '');
}

/** Sufixo curto e estável derivado do id (UUID) para garantir unicidade. */
export function shortId(id: string, length = 6): string {
  return id
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, length);
}

export interface SlugSource {
  brand: string;
  model: string;
  version?: string | null;
  modelYear?: number | null;
  manufactureYear?: number | null;
}

export function buildVehicleSlug(source: SlugSource, id: string, suffixLength = 6): string {
  const year = source.modelYear ?? source.manufactureYear ?? null;
  const base = slugify([source.brand, source.model, source.version ?? '', year ? String(year) : ''].join(' '));
  const suffix = shortId(id, suffixLength);
  return base ? `${base}-${suffix}` : `veiculo-${suffix}`;
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 120;
}
