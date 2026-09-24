import type { CommercialType, VehicleStatus } from '@/config/catalog';
import { isOfferActive, type OfferFields } from './offer';

export type BadgeKind = 'sold' | 'reserved' | 'offer' | 'repasse' | 'featured';

export interface Badge {
  kind: BadgeKind;
  label: string;
}

const LABELS: Record<BadgeKind, string> = {
  sold: 'Vendido',
  reserved: 'Reservado',
  offer: 'Oferta',
  repasse: 'Repasse',
  featured: 'Destaque',
};

export interface BadgeSource extends OfferFields {
  status: VehicleStatus;
  commercialType: CommercialType;
  featured: boolean;
}

export interface BadgeOptions {
  /** Máximo de selos exibidos (hierarquia define quais aparecem). */
  max?: number;
  /** Oculta "Destaque" (ex.: dentro da própria seção de destaques). */
  hideFeatured?: boolean;
  now?: Date;
}

/**
 * Hierarquia visual:
 *  1. Vendido (exclusivo — nenhum outro selo aparece)
 *  2. Reservado
 *  3. Oferta (somente se ativa)
 *  4. Repasse
 *  5. Destaque (apenas quando sobra espaço)
 */
export function getVehicleBadges(vehicle: BadgeSource, options: BadgeOptions = {}): Badge[] {
  const { max = 2, hideFeatured = false, now = new Date() } = options;
  if (vehicle.status === 'sold') return [{ kind: 'sold', label: LABELS.sold }];

  const kinds: BadgeKind[] = [];
  if (vehicle.status === 'reserved') kinds.push('reserved');
  if (isOfferActive(vehicle, now)) kinds.push('offer');
  if (vehicle.commercialType === 'repasse') kinds.push('repasse');
  if (vehicle.featured && !hideFeatured) kinds.push('featured');

  return kinds.slice(0, Math.max(0, max)).map((kind) => ({ kind, label: LABELS[kind] }));
}
