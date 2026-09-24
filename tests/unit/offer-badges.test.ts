import { describe, expect, it } from 'vitest';
import { getVehicleBadges, type BadgeSource } from '@/utils/badges';
import { getPriceDisplay, isOfferActive } from '@/utils/offer';

const now = new Date('2026-09-23T15:00:00.000Z');
const base = { isOffer: true, offerStartAt: null, offerEndAt: null };

describe('isOfferActive', () => {
  it('oferta sem datas está ativa', () => {
    expect(isOfferActive(base, now)).toBe(true);
  });
  it('não ativa quando desmarcada', () => {
    expect(isOfferActive({ ...base, isOffer: false }, now)).toBe(false);
  });
  it('respeita início futuro e fim passado', () => {
    expect(isOfferActive({ ...base, offerStartAt: '2026-10-01T03:00:00.000Z' }, now)).toBe(false);
    expect(isOfferActive({ ...base, offerEndAt: '2026-09-20T02:59:59.999Z' }, now)).toBe(false);
    expect(
      isOfferActive({ ...base, offerStartAt: '2026-09-01T03:00:00.000Z', offerEndAt: '2026-09-30T02:59:59.999Z' }, now),
    ).toBe(true);
  });
});

describe('getPriceDisplay', () => {
  it('mostra De/Por somente em oferta ativa com preço anterior maior', () => {
    const display = getPriceDisplay({ ...base, price: 11_890_000, previousPrice: 12_490_000 }, now);
    expect(display.previous).toBe(12_490_000);
    expect(display.savings).toBe(600_000);
    // 6000/124900 = 4,80% -> arredonda PARA BAIXO: 4%
    expect(display.discountPercent).toBe(4);
  });

  it('não exibe preço anterior fora de oferta', () => {
    const display = getPriceDisplay({ ...base, isOffer: false, price: 100, previousPrice: 200 }, now);
    expect(display.previous).toBeNull();
    expect(display.discountPercent).toBeNull();
  });

  it('ignora preço anterior menor ou igual ao atual', () => {
    expect(getPriceDisplay({ ...base, price: 200, previousPrice: 200 }, now).previous).toBeNull();
    expect(getPriceDisplay({ ...base, price: 200, previousPrice: 100 }, now).previous).toBeNull();
  });

  it('não calcula desconto sem preço atual', () => {
    expect(getPriceDisplay({ ...base, price: null, previousPrice: 200 }, now).previous).toBeNull();
  });

  it('não exibe percentual abaixo de 1%', () => {
    const d = getPriceDisplay({ ...base, price: 9_950_000, previousPrice: 10_000_000 }, now);
    expect(d.previous).toBe(10_000_000);
    expect(d.discountPercent).toBeNull();
  });
});

describe('getVehicleBadges (hierarquia)', () => {
  const v: BadgeSource = {
    status: 'available',
    commercialType: 'repasse',
    featured: true,
    isOffer: true,
    offerStartAt: null,
    offerEndAt: null,
  };

  it('vendido é exclusivo', () => {
    expect(getVehicleBadges({ ...v, status: 'sold' }, { now }).map((b) => b.kind)).toEqual(['sold']);
  });

  it('ordem: reservado > oferta > repasse > destaque, limitada', () => {
    expect(getVehicleBadges({ ...v, status: 'reserved' }, { now, max: 5 }).map((b) => b.kind)).toEqual([
      'reserved',
      'offer',
      'repasse',
      'featured',
    ]);
    expect(getVehicleBadges(v, { now }).map((b) => b.kind)).toEqual(['offer', 'repasse']);
  });

  it('oferta vencida não gera selo e destaque pode ser ocultado', () => {
    const expired = { ...v, commercialType: 'normal' as const, offerEndAt: '2026-01-01T00:00:00.000Z' };
    expect(getVehicleBadges(expired, { now }).map((b) => b.kind)).toEqual(['featured']);
    expect(getVehicleBadges(expired, { now, hideFeatured: true })).toEqual([]);
  });

  it('destaque, oferta e repasse são independentes', () => {
    const onlyRepasse = { ...v, featured: false, isOffer: false };
    expect(getVehicleBadges(onlyRepasse, { now }).map((b) => b.kind)).toEqual(['repasse']);
  });
});
