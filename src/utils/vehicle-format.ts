import {
  CATEGORY_INFO,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  type Fuel,
  type Transmission,
  type VehicleCategory,
} from '@/config/catalog';
import { formatNumber } from './money';

interface TitleFields {
  brand: string;
  model: string;
  version?: string | null;
}

interface YearFields {
  manufactureYear: number | null;
  modelYear: number | null;
}

/** "Toyota Corolla" */
export function vehicleName(v: TitleFields): string {
  return `${v.brand} ${v.model}`.trim();
}

/** "Toyota Corolla XEi 2.0" */
export function vehicleFullName(v: TitleFields): string {
  return [v.brand, v.model, v.version ?? ''].join(' ').replace(/\s+/g, ' ').trim();
}

/** "2021/2022", "2022" ou "" */
export function yearLabel(v: YearFields): string {
  const { manufactureYear: fab, modelYear: mod } = v;
  if (fab && mod && fab !== mod) return `${fab}/${mod}`;
  return String(mod ?? fab ?? '');
}

/** "Toyota Corolla XEi 2.0 2021/2022" — usado em mensagens e títulos. */
export function vehicleTitleWithYear(v: TitleFields & YearFields): string {
  return [vehicleFullName(v), yearLabel(v)].filter(Boolean).join(' ');
}

export function mileageLabel(km: number | null): string {
  if (km === null) return '';
  if (km === 0) return '0 km';
  return `${formatNumber(km)} km`;
}

export function hoursLabel(hours: number | null): string {
  if (hours === null) return '';
  return `${formatNumber(hours)} h`;
}

/** Uso principal: horas para máquinas agrícolas (quando informado), km para os demais. */
export function usageLabel(v: {
  category: VehicleCategory;
  mileage: number | null;
  usageHours: number | null;
}): string {
  if (CATEGORY_INFO[v.category].usesHours && v.usageHours !== null) return hoursLabel(v.usageHours);
  if (v.mileage !== null) return mileageLabel(v.mileage);
  if (v.usageHours !== null) return hoursLabel(v.usageHours);
  return '';
}

export function fuelLabel(fuel: Fuel | null): string {
  return fuel ? FUEL_LABELS[fuel] : '';
}

export function transmissionLabel(transmission: Transmission | null): string {
  return transmission ? TRANSMISSION_LABELS[transmission] : '';
}

export function locationLabel(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(' - ');
}
