import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/config/site';
import { emptyVehicleValues, parseVehicleForm } from '@/server/vehicle-form';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const base = { category: 'carro', brand: 'Toyota', model: 'Corolla', status: 'available' };

describe('formulário de veículo: Ofertas e Repasses', () => {
  it('cadastro novo já vem marcado nas duas seções', () => {
    const values = emptyVehicleValues(DEFAULT_SETTINGS);
    expect(values.isOffer).toBe('on');
    expect(values.commercialType).toBe('repasse');
  });

  it('as duas caixas marcadas viram oferta + repasse', () => {
    const r = parseVehicleForm(form({ ...base, isOffer: 'on', isRepasse: 'on' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect([r.data.isOffer, r.data.commercialType]).toEqual([true, 'repasse']);
  });

  it('só Repasses marcado', () => {
    const r = parseVehicleForm(form({ ...base, isRepasse: 'on' }));
    expect(r.ok && [r.data.isOffer, r.data.commercialType]).toEqual([false, 'repasse']);
  });

  it('nenhuma marcada: veículo normal, sem oferta', () => {
    const r = parseVehicleForm(form(base));
    expect(r.ok && [r.data.isOffer, r.data.commercialType]).toEqual([false, 'normal']);
  });

  it('ao voltar com erro, a caixa de Repasses continua como o admin deixou', () => {
    const r = parseVehicleForm(form({ category: 'carro', isRepasse: 'on' }));
    expect(r.ok).toBe(false);
    expect(r.values.commercialType).toBe('repasse');
    expect('isRepasse' in r.values).toBe(false);
  });
});
