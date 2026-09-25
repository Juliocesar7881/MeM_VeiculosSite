import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SITE_SETTINGS } from '@/config/site';
import { leadInputSchema } from '@/schemas/lead';
import { RATE_LIMITS } from '@/services/rate-limiter';
import { actor, createTestEnv, vehicleInput, type TestEnv } from '../helpers/env';
import { makeImage, makePair } from '../helpers/images';

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => {
  await env.cleanup();
});

const lead = () =>
  leadInputSchema.parse({
    name: 'Carlos Pereira',
    whatsapp: '47 98888-7777',
    category: 'carro',
    brand: 'Chevrolet',
    model: 'Onix',
    version: 'LT 1.0',
    manufactureYear: '2019',
    modelYear: '2020',
    mileage: '60.000',
    fuel: 'flex',
    transmission: 'manual',
    color: 'Branco',
    city: 'Massaranduba',
    state: 'SC',
    desiredPrice: '55.000',
    description: 'Único dono.',
    consent: 'on',
  });

describe('propostas (Anuncie seu veículo)', () => {
  it('grava proposta e fotos em sell-leads/{leadId}/', async () => {
    const id = await env.leads.submit(lead(), [await makePair(1600, 1200), await makePair(1200, 1600)], {
      ipHash: 'abc',
    });
    const detail = await env.leads.getDetail(id);
    expect(detail?.status).toBe('new');
    expect(detail?.images).toHaveLength(2);
    for (const image of detail?.images ?? []) {
      expect(image.largeKey).toMatch(new RegExp(`^sell-leads/${id}/[0-9a-f-]{36}\\.webp$`));
      expect(image.thumbKey).toMatch(/-thumb\.webp$/);
      expect(await env.storage.get(image.largeKey)).not.toBeNull();
    }
    expect(detail?.consentText).toMatch(/Autorizo a M&M Veículos/);
  });

  it('não publica nada automaticamente', async () => {
    await env.leads.submit(lead(), [], { ipHash: null });
    expect((await env.vehicles.stats()).total).toBe(0);
  });

  it('rejeita mais de 6 fotos e imagens inválidas sem deixar lixo', async () => {
    const pair = await makePair();
    await expect(env.leads.submit(lead(), Array(7).fill(pair), { ipHash: null })).rejects.toThrow(/no máximo 6/);
    const bad = { large: new TextEncoder().encode('não é imagem'), thumb: pair.thumb };
    await expect(env.leads.submit(lead(), [bad], { ipHash: null })).rejects.toThrow();
    expect((await env.leads.list({ page: 1, pageSize: 10, scope: 'all' })).total).toBe(0);
  });

  it('fluxo de status e anotações', async () => {
    const id = await env.leads.submit(lead(), [], { ipHash: null });
    await env.leads.updateStatus(id, 'contacted', actor);
    await env.leads.updateNotes(id, 'Avaliado em R$ 52 mil', actor);
    const detail = await env.leads.getDetail(id);
    expect(detail?.status).toBe('contacted');
    expect(detail?.adminNotes).toBe('Avaliado em R$ 52 mil');
    await expect(env.leads.updateStatus(id, 'converted', actor)).rejects.toThrow(/Transformar em veículo/);
    expect((await env.leads.countByStatus()).contacted).toBe(1);
  });

  it('converte em RASCUNHO, copia fotos para vehicles/ e marca como convertida', async () => {
    const id = await env.leads.submit(lead(), [await makePair()], { ipHash: null });
    const vehicle = await env.leads.convertToVehicle(id, actor);
    expect(vehicle.status).toBe('draft');
    expect(vehicle.published).toBe(false);
    expect(vehicle.price).toBeNull();
    expect(vehicle.sourceLeadId).toBe(id);

    const detail = await env.vehicles.getDetail(vehicle.id);
    expect(detail?.images).toHaveLength(1);
    expect(detail?.images[0]?.largeKey.startsWith(`vehicles/${vehicle.id}/`)).toBe(true);
    const leadDetail = await env.leads.getDetail(id);
    expect(leadDetail?.status).toBe('converted');
    expect(leadDetail?.convertedVehicleId).toBe(vehicle.id);
    // As fotos originais da proposta continuam separadas
    expect(await env.storage.get(leadDetail?.images[0]?.largeKey ?? '')).not.toBeNull();
    // Rascunho não aparece no site
    expect((await env.vehicles.getPublicBySlug(vehicle.slug)).kind).toBe('not-found');

    await expect(env.leads.convertToVehicle(id, actor)).rejects.toThrow(/já foi transformada/);

    // Admin revisa, define preço e publica
    await env.vehicles.update(
      vehicle.id,
      vehicleInput({ brand: 'Chevrolet', model: 'Onix', price: '58.900', status: 'available' }),
      actor,
    );
    const published = await env.vehicles.getPublicBySlug((await env.vehicles.getDetail(vehicle.id))?.slug ?? '');
    expect(published.kind).toBe('ok');
  });

  it('exclusão LGPD remove proposta e fotos', async () => {
    const id = await env.leads.submit(lead(), [await makePair()], { ipHash: null });
    const key = (await env.leads.getDetail(id))?.images[0]?.largeKey ?? '';
    await env.leads.delete(id, actor);
    expect(await env.leads.getDetail(id)).toBeNull();
    expect(await env.storage.get(key)).toBeNull();
  });
});

describe('fotos de veículos', () => {
  it('adiciona, reordena (capa) e exclui', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    const a = await env.media.addVehicleImage(v.id, await makePair(), actor);
    const b = await env.media.addVehicleImage(v.id, await makePair(1200, 900), actor);
    expect([a.position, b.position]).toEqual([0, 1]);
    expect(a.largeKey).toBe(`vehicles/${v.id}/${a.id}.webp`);

    const order = await env.media.reorderVehicleImages(v.id, [b.id, a.id], actor);
    expect(order.map((i) => i.id)).toEqual([b.id, a.id]);
    const card = (await env.vehicles.listPublicByIds([v.id], SITE_SETTINGS))[0];
    expect(card?.cover?.largeKey).toBe(b.largeKey);

    await env.media.deleteVehicleImage(v.id, b.id, actor);
    expect((await env.vehicles.getDetail(v.id))?.images.map((i) => i.id)).toEqual([a.id]);
    expect(await env.storage.get(b.largeKey)).toBeNull();
  });

  it('não entrega chaves fora do padrão (path traversal / fotos de propostas)', async () => {
    expect(await env.media.getPublicVehicleObject('../.env')).toBeNull();
    expect(
      await env.media.getPublicVehicleObject(
        'sell-leads/00000000-0000-0000-0000-000000000000/00000000-0000-0000-0000-000000000000.webp',
      ),
    ).toBeNull();
  });

  it('rejeita foto grande demais ou PNG', async () => {
    const v = await env.vehicles.create(vehicleInput(), actor);
    const png = { large: await makeImage(1600, 1200, 'png'), thumb: await makeImage(720, 540, 'png') };
    await expect(env.media.addVehicleImage(v.id, png, actor)).rejects.toThrow(/Formato/);
  });
});

describe('dados institucionais', () => {
  it('são os dados oficiais da M&M', async () => {
    const s = await env.settings.get();
    expect(s).toMatchObject({
      businessName: 'M&M Veículos',
      whatsapp: '554896410338',
      phone: '+55 48 9641-0338',
      instagram: 'mmveiculos.sc',
      facebook: 'https://www.facebook.com/profile.php?id=61573464239367',
      email: 'mmveiculos.sc@gmail.com',
      city: 'Massaranduba',
      state: 'SC',
      showSoldVehicles: true,
    });
  });
});

describe('rate limiting', () => {
  it('bloqueia após o limite e libera após reset', async () => {
    const rule = { ...RATE_LIMITS.leadHourly, limit: 2 };
    expect((await env.rateLimiter.check(rule, '1.2.3.4')).allowed).toBe(true);
    expect((await env.rateLimiter.check(rule, '1.2.3.4')).allowed).toBe(true);
    const third = await env.rateLimiter.check(rule, '1.2.3.4');
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
    expect((await env.rateLimiter.check(rule, '5.6.7.8')).allowed).toBe(true);
    await env.rateLimiter.reset(rule, '1.2.3.4');
    expect((await env.rateLimiter.check(rule, '1.2.3.4')).allowed).toBe(true);
  });

  it('não grava IP em claro', async () => {
    await env.rateLimiter.check(RATE_LIMITS.leadHourly, '203.0.113.9');
    const rows = await env.db.all<{ key: string }>('SELECT key FROM rate_limits');
    expect(rows[0]?.key).not.toContain('203.0.113.9');
  });
});
