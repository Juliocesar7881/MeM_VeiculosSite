import type { Cents } from '@/types/domain';

export interface OfferFields {
  isOffer: boolean;
  offerStartAt: string | null;
  offerEndAt: string | null;
}

export interface PriceFields extends OfferFields {
  price: Cents | null;
  previousPrice: Cents | null;
}

/**
 * Oferta ativa = marcada como oferta E dentro do período (quando definido).
 * Datas nulas significam "sem limite".
 */
export function isOfferActive(vehicle: OfferFields, now: Date = new Date()): boolean {
  if (!vehicle.isOffer) return false;
  const t = now.getTime();
  if (vehicle.offerStartAt && new Date(vehicle.offerStartAt).getTime() > t) return false;
  if (vehicle.offerEndAt && new Date(vehicle.offerEndAt).getTime() <= t) return false;
  return true;
}

export interface PriceDisplay {
  current: Cents | null;
  /** Só é preenchido em oferta ativa com preço anterior maior que o atual. */
  previous: Cents | null;
  /** Percentual arredondado PARA BAIXO (nunca exagera o desconto). */
  discountPercent: number | null;
  savings: Cents | null;
}

export function getPriceDisplay(vehicle: PriceFields, now: Date = new Date()): PriceDisplay {
  const current = vehicle.price;
  const showPrevious =
    isOfferActive(vehicle, now) &&
    current !== null &&
    current > 0 &&
    vehicle.previousPrice !== null &&
    vehicle.previousPrice > current;

  if (!showPrevious || current === null || vehicle.previousPrice === null) {
    return { current, previous: null, discountPercent: null, savings: null };
  }

  const previous = vehicle.previousPrice;
  const savings = previous - current;
  const percent = Math.floor((savings / previous) * 100);
  return {
    current,
    previous,
    savings,
    discountPercent: percent >= 1 ? percent : null,
  };
}
