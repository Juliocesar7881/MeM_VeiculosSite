import { describe, expect, it } from 'vitest';
import { countActiveFilters, filtersToSearchParams, inventoryHref, parseInventoryFilters } from '@/schemas/filters';

const parse = (qs: string) => parseInventoryFilters(new URLSearchParams(qs));

describe('parseInventoryFilters', () => {
  it('lê os parâmetros documentados', () => {
    const f = parse(
      'marca=Toyota&categoria=carros&oferta=true&repasse=true&ano_min=2018&ano_max=2022&preco_min=50.000&preco_max=120000&combustivel=flex&cambio=automatico&tipo=normal&status=disponivel&ordem=menor-preco&pagina=2&q=corolla',
    );
    expect(f).toMatchObject({
      brand: 'Toyota',
      category: 'carro',
      offersOnly: true,
      repasseOnly: true,
      yearMin: 2018,
      yearMax: 2022,
      priceMin: 50_000,
      priceMax: 120_000,
      fuel: 'flex',
      transmission: 'automatico',
      commercialType: 'normal',
      status: 'available',
      sort: 'menor-preco',
      page: 2,
      q: 'corolla',
    });
  });

  it('ignora valores inválidos sem quebrar', () => {
    const f = parse('categoria=avioes&combustivel=agua&ordem=aleatorio&pagina=-3&ano_min=abc&status=perdido');
    expect(f.category).toBeUndefined();
    expect(f.fuel).toBeUndefined();
    expect(f.sort).toBe('recentes');
    expect(f.page).toBe(1);
    expect(f.yearMin).toBeUndefined();
    expect(f.status).toBeUndefined();
  });

  it('inverte faixas trocadas', () => {
    const f = parse('ano_min=2022&ano_max=2015&preco_min=90000&preco_max=10000');
    expect([f.yearMin, f.yearMax]).toEqual([2015, 2022]);
    expect([f.priceMin, f.priceMax]).toEqual([10_000, 90_000]);
  });

  it('remove caracteres de controle e HTML da busca', () => {
    expect(parse('q=<script>alert(1)</script>').q).toBe('scriptalert(1)/script');
  });
});

describe('serialização', () => {
  it('ida e volta preserva os filtros', () => {
    const f = parse('marca=Honda&categoria=motos&oferta=true&ordem=maior-km');
    const back = parseInventoryFilters(filtersToSearchParams(f));
    expect(back).toEqual(f);
  });

  it('omite valores padrão e aplica overrides', () => {
    const f = parse('marca=Fiat&pagina=3');
    expect(inventoryHref(f, { page: 1 })).toBe('/estoque?marca=Fiat');
    expect(inventoryHref(f, {}, '/ofertas')).toBe('/ofertas?marca=Fiat&pagina=3');
    expect(inventoryHref({})).toBe('/estoque');
  });

  it('conta filtros ativos', () => {
    expect(countActiveFilters(parse('marca=Fiat&oferta=true&q=uno'))).toBe(2);
  });
});
