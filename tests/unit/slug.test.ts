import { describe, expect, it } from 'vitest';
import { buildVehicleSlug, isValidSlug, shortId, slugify } from '@/utils/slug';

describe('slugify', () => {
  it('remove acentos, pontuação e espaços', () => {
    expect(slugify('Corolla XEi 2.0 Flex')).toBe('corolla-xei-2-0-flex');
    expect(slugify('Veículo  Elétrico — Ótimo!')).toBe('veiculo-eletrico-otimo');
  });

  it('troca & por "e"', () => {
    expect(slugify('M&M Veículos')).toBe('m-e-m-veiculos');
  });

  it('limita o tamanho e não termina com hífen', () => {
    const slug = slugify('a'.repeat(50) + ' ' + 'b'.repeat(50));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('buildVehicleSlug', () => {
  const id = '1cbdcb65-778e-4915-8500-bd858b782824';

  it('combina marca, modelo, versão, ano e sufixo do id', () => {
    expect(
      buildVehicleSlug(
        { brand: 'Toyota', model: 'Corolla', version: 'XEi 2.0', modelYear: 2022, manufactureYear: 2021 },
        id,
      ),
    ).toBe('toyota-corolla-xei-2-0-2022-1cbdcb');
  });

  it('usa ano de fabricação quando não há ano modelo', () => {
    expect(buildVehicleSlug({ brand: 'Honda', model: 'CG 160', manufactureYear: 2023 }, id)).toBe(
      'honda-cg-160-2023-1cbdcb',
    );
  });

  it('aceita sufixo maior para resolver colisões', () => {
    expect(buildVehicleSlug({ brand: 'Fiat', model: 'Uno' }, id, 12)).toBe('fiat-uno-1cbdcb65778e');
  });

  it('gera slugs válidos', () => {
    expect(isValidSlug(buildVehicleSlug({ brand: 'VW', model: 'Gol' }, id))).toBe(true);
    expect(isValidSlug('../etc/passwd')).toBe(false);
    expect(isValidSlug('Com-Maiuscula')).toBe(false);
  });

  it('shortId remove hífens', () => {
    expect(shortId(id, 8)).toBe('1cbdcb65');
  });
});
