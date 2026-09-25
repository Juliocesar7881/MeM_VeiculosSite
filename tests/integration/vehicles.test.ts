import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, parseInventoryFilters } from '@/schemas/filters';
import { DEFAULT_SETTINGS } from '@/config/site';
import { actor, createTestEnv, vehicleInput, type TestEnv } from '../helpers/env';
import { makePair } from '../helpers/images';

let env: TestEnv;
const settings = { ...DEFAULT_SETTINGS, showSoldVehicles: true };
const filters = (qs = '') => parseInventoryFilters(new URLSearchParams(qs));

beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.cleanup();
});

describe('cadastro e edição', () => {
  it('cria com slug amigável, opcionais e busca normalizada', async () => {
    const v = await env.vehicles.create(vehicleInput({ features: ['Multimídia', 'Câmera de ré'] }), actor);
    expect(v.slug).toMatch(/^toyota-corolla-xei-2-0-2022-[a-z0-9]{6}$/);
    expect(v.publishedAt).not.toBeNull();
    const detail = await env.vehicles.getDetail(v.id);
    expect(detail?.features).toEqual(['Multimídia', 'Câmera de ré']);
    const result = await env.vehicles.search(filters('q=corola xei'), settings);
    expect(result.total).toBe(0); // "corola" (com erro) não casa
    expect((await env.vehicles.search(filters('q=COROLLA xei'), settings)).total).toBe(1);
  });

  it('a publicação segue o status: só Rascunho e Arquivado ficam fora do site', async () => {
    for (const status of ['available', 'reserved', 'sold'] as const) {
      expect((await env.vehicles.create(vehicleInput({ status }), actor)).published).toBe(true);
    }
    for (const status of ['draft', 'archived'] as const) {
      expect((await env.vehicles.create(vehicleInput({ status }), actor)).published).toBe(false);
    }
    // Um campo "published" enviado à parte é ignorado.
    const draft = await env.vehicles.create(vehicleInput({ status: 'draft', published: 'on' }), actor);
    expect([draft.status, draft.published]).toEqual(['draft', false]);
  });

  it('salvar como Disponível publica; voltar para Rascunho tira do site', async () => {
    const v = await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    const live = await env.vehicles.update(v.id, vehicleInput({ status: 'available' }), actor);
    expect(live.published).toBe(true);
    expect(live.publishedAt).not.toBeNull();
    expect((await env.vehicles.getPublicBySlug(live.slug)).kind).toBe('ok');
    const back = await env.vehicles.update(v.id, vehicleInput({ status: 'draft' }), actor);
    expect(back.published).toBe(false);
    expect((await env.vehicles.getPublicBySlug(back.slug)).kind).toBe('not-found');
  });

  it('ao mudar marca/modelo gera novo slug e o antigo redireciona', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    const updated = await env.vehicles.update(v.id, vehicleInput({ model: 'Corolla Cross' }), actor);
    expect(updated.slug).not.toBe(v.slug);
    expect(await env.vehicles.getPublicBySlug(v.slug)).toEqual({ kind: 'redirect', slug: updated.slug });
    expect((await env.vehicles.getPublicBySlug(updated.slug)).kind).toBe('ok');
  });

  it('mantém o slug quando só o preço muda', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    const updated = await env.vehicles.update(v.id, vehicleInput({ price: '99.000' }), actor);
    expect(updated.slug).toBe(v.slug);
    expect(updated.price).toBe(9_900_000);
  });
});

describe('visibilidade pública', () => {
  it('rascunho, tirado do site e arquivado não aparecem; vendido abre pelo link', async () => {
    const draft = await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    const listed = await env.vehicles.create(vehicleInput(), actor);
    const hidden = await env.vehicles.quickAction(listed.id, 'unpublish', actor);
    const sold = await env.vehicles.create(vehicleInput({ status: 'sold' }), actor);
    const archived = await env.vehicles.create(vehicleInput({ status: 'archived' }), actor);

    expect((await env.vehicles.getPublicBySlug(draft.slug)).kind).toBe('not-found');
    expect((await env.vehicles.getPublicBySlug(hidden.slug)).kind).toBe('not-found');
    expect((await env.vehicles.getPublicBySlug(archived.slug)).kind).toBe('not-found');
    expect((await env.vehicles.getPublicBySlug(sold.slug)).kind).toBe('ok');

    expect((await env.vehicles.search(filters(), settings)).total).toBe(1);
    expect((await env.vehicles.search(filters(), { ...settings, showSoldVehicles: false })).total).toBe(0);
  });

  it('vendidos aparecem por último na listagem', async () => {
    await env.vehicles.create(vehicleInput({ status: 'sold', price: '1.000' }), actor);
    await env.vehicles.create(vehicleInput({ price: '50.000' }), actor);
    const result = await env.vehicles.search(filters('ordem=menor-preco'), settings);
    expect(result.items.map((v) => v.status)).toEqual(['available', 'sold']);
  });
});

describe('filtros e ordenação', () => {
  beforeEach(async () => {
    await env.vehicles.create(
      vehicleInput({
        brand: 'Honda',
        model: 'CG 160',
        category: 'moto',
        price: '17.900',
        mileage: '8.000',
        manufactureYear: '2023',
        modelYear: '2023',
      }),
      actor,
    );
    await env.vehicles.create(
      vehicleInput({
        brand: 'Fiat',
        model: 'Strada',
        price: '84.500',
        mileage: '63.000',
        commercialType: 'repasse',
        manufactureYear: '2021',
        modelYear: '2021',
      }),
      actor,
    );
    await env.vehicles.create(
      vehicleInput({
        brand: 'Toyota',
        model: 'Corolla',
        price: '118.900',
        previousPrice: '124.900',
        isOffer: 'on',
        mileage: '42.000',
      }),
      actor,
    );
    await env.vehicles.create(
      vehicleInput({
        brand: 'Jeep',
        model: 'Compass',
        price: '',
        mileage: '',
        manufactureYear: '2022',
        modelYear: '2022',
      }),
      actor,
    );
  });

  it('marca (sem diferenciar maiúsculas), categoria e faixa de preço', async () => {
    expect((await env.vehicles.search(filters('marca=toyota'), settings)).total).toBe(1);
    expect((await env.vehicles.search(filters('categoria=motos'), settings)).items[0]?.model).toBe('CG 160');
    const range = await env.vehicles.search(filters('preco_min=50000&preco_max=100000'), settings);
    expect(range.items.map((v) => v.model)).toEqual(['Strada']);
  });

  it('ofertas e repasses são filtros independentes', async () => {
    expect((await env.vehicles.search(filters('oferta=true'), settings)).items.map((v) => v.model)).toEqual([
      'Corolla',
    ]);
    expect((await env.vehicles.search(filters('repasse=true'), settings)).items.map((v) => v.model)).toEqual([
      'Strada',
    ]);
    expect((await env.vehicles.search(filters('tipo=normal'), settings)).total).toBe(3);
  });

  it('ordena por preço com "sob consulta" por último', async () => {
    const asc = await env.vehicles.search(filters('ordem=menor-preco'), settings);
    expect(asc.items.map((v) => v.model)).toEqual(['CG 160', 'Strada', 'Corolla', 'Compass']);
    const desc = await env.vehicles.search(filters('ordem=maior-preco'), settings);
    expect(desc.items.map((v) => v.model)).toEqual(['Corolla', 'Strada', 'CG 160', 'Compass']);
  });

  it('ordena por km', async () => {
    const asc = await env.vehicles.search(filters('ordem=menor-km'), settings);
    expect(asc.items.map((v) => v.model)).toEqual(['CG 160', 'Corolla', 'Strada', 'Compass']);
  });

  it('pagina resultados', async () => {
    const page1 = await env.vehicles.search({ ...DEFAULT_FILTERS, page: 1 }, settings, 3);
    const page2 = await env.vehicles.search({ ...DEFAULT_FILTERS, page: 2 }, settings, 3);
    expect(page1.items).toHaveLength(3);
    expect(page2.items).toHaveLength(1);
    expect(page1.totalPages).toBe(2);
  });

  it('facetas trazem marcas e modelos existentes', async () => {
    const facets = await env.vehicles.facets(filters('marca=Fiat'), settings);
    expect(facets.brands.map((b) => b.value)).toEqual(['Fiat', 'Honda', 'Jeep', 'Toyota']);
    expect(facets.models.map((m) => m.value)).toEqual(['Strada']);
  });

  it('seções da Home', async () => {
    const home = await env.vehicles.homeSections();
    expect(home.offers.map((v) => v.model)).toEqual(['Corolla']);
    expect(home.repasses.map((v) => v.model)).toEqual(['Strada']);
    expect(home.offersTotal).toBe(1);
    expect(home.latest.length).toBe(4); // sem destaques -> mostra os mais recentes
  });
});

describe('ofertas com período', () => {
  it('oferta futura ou vencida não entra em /ofertas', async () => {
    await env.vehicles.create(vehicleInput({ isOffer: 'on', offerStartDate: '2099-01-01' }), actor);
    await env.vehicles.create(vehicleInput({ isOffer: 'on', offerEndDate: '2020-01-01' }), actor);
    await env.vehicles.create(
      vehicleInput({ isOffer: 'on', offerStartDate: '2020-01-01', offerEndDate: '2099-12-31' }),
      actor,
    );
    expect((await env.vehicles.search(filters('oferta=true'), settings)).total).toBe(1);
    expect((await env.vehicles.stats()).offers).toBe(1);
  });
});

describe('ações rápidas e status', () => {
  it('vender remove destaque e registra data; reservar/disponível limpam a venda', async () => {
    const v = await env.vehicles.create(vehicleInput({ featured: 'on' }), actor);
    const sold = await env.vehicles.quickAction(v.id, 'mark-sold', actor);
    expect(sold.status).toBe('sold');
    expect(sold.featured).toBe(false);
    expect(sold.soldAt).not.toBeNull();
    const back = await env.vehicles.quickAction(v.id, 'mark-available', actor);
    expect(back.soldAt).toBeNull();
  });

  it('oferta, repasse e destaque alternam independentemente', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    await env.vehicles.quickAction(v.id, 'offer-on', actor);
    await env.vehicles.quickAction(v.id, 'repasse-on', actor);
    const featured = await env.vehicles.quickAction(v.id, 'feature', actor);
    expect([featured.isOffer, featured.commercialType, featured.featured]).toEqual([true, 'repasse', true]);
    const noOffer = await env.vehicles.quickAction(v.id, 'offer-off', actor);
    expect([noOffer.isOffer, noOffer.commercialType, noOffer.featured]).toEqual([false, 'repasse', true]);
  });

  it('arquivar despublica; publicar arquivado é bloqueado', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    const archived = await env.vehicles.quickAction(v.id, 'archive', actor);
    expect(archived.published).toBe(false);
    await expect(env.vehicles.quickAction(v.id, 'publish', actor)).rejects.toThrow(/Desarquive/);
    // Marcar como disponível (a partir de arquivado) volta para o site.
    expect((await env.vehicles.quickAction(v.id, 'mark-available', actor)).published).toBe(true);
  });

  it('ações rápidas: publicar rascunho e tirar do site', async () => {
    const v = await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    const live = await env.vehicles.quickAction(v.id, 'publish', actor);
    expect([live.status, live.published]).toEqual(['available', true]);
    const off = await env.vehicles.quickAction(v.id, 'unpublish', actor);
    expect([off.status, off.published]).toEqual(['draft', false]);
  });

  it('excluir remove do site e apaga as fotos do storage', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    const image = await env.media.addVehicleImage(v.id, await makePair(), actor);
    expect(await env.storage.get(image.largeKey)).not.toBeNull();
    await env.vehicles.quickAction(v.id, 'delete', actor);
    expect(await env.vehicles.getDetail(v.id)).toBeNull();
    expect(await env.storage.get(image.largeKey)).toBeNull();
    expect((await env.vehicles.getPublicBySlug(v.slug)).kind).toBe('not-found');
  });

  it('estatísticas do dashboard', async () => {
    await env.vehicles.create(vehicleInput(), actor);
    await env.vehicles.create(vehicleInput({ status: 'reserved', commercialType: 'repasse' }), actor);
    await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    const stats = await env.vehicles.stats();
    expect(stats).toMatchObject({ total: 3, available: 1, reserved: 1, drafts: 1, repasses: 1 });
  });

  it('registra auditoria', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    await env.vehicles.quickAction(v.id, 'mark-reserved', actor);
    const log = await env.audit.listForEntity('vehicle', v.id);
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(['vehicle.create', 'vehicle.mark-reserved']));
  });
});
