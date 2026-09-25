import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatsRepository } from '@/repositories/stats-repository';
import { StatsService } from '@/services/stats-service';
import { actor, createTestEnv, vehicleInput, type TestEnv } from '../helpers/env';

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
});
afterEach(async () => env.cleanup());

describe('métricas anônimas (visualizações e cliques no WhatsApp)', () => {
  it('conta por veículo e soma no período', async () => {
    const a = await env.vehicles.create(vehicleInput(), actor);
    const b = await env.vehicles.create(vehicleInput({ brand: 'Honda', model: 'Civic' }), actor);

    for (let i = 0; i < 3; i += 1) await env.stats.record(a.id, 'view');
    await env.stats.record(a.id, 'whatsapp');
    await env.stats.record(b.id, 'view');
    await env.stats.record(b.id, 'whatsapp');
    await env.stats.record(b.id, 'whatsapp');

    expect(await env.stats.forVehicle(a.id)).toEqual({ views: 3, whatsappClicks: 1 });
    const overview = await env.stats.overview();
    expect(overview.views).toBe(4);
    expect(overview.whatsappClicks).toBe(3);
    // Ordenado por cliques no WhatsApp
    expect(overview.top.map((r) => r.model)).toEqual(['Civic', 'Corolla']);
  });

  it('ignora IDs inválidos e veículos fora do site (rascunho, despublicado, excluído)', async () => {
    const draft = await env.vehicles.create(vehicleInput({ status: 'draft' }), actor);
    const hidden = await env.vehicles.create(vehicleInput(), actor);
    await env.vehicles.quickAction(hidden.id, 'unpublish', actor);
    const deleted = await env.vehicles.create(vehicleInput(), actor);
    await env.vehicles.quickAction(deleted.id, 'delete', actor);

    expect(await env.stats.record('nao-e-um-id', 'view')).toBe(false);
    expect(await env.stats.record('00000000-0000-4000-8000-000000000000', 'view')).toBe(false);
    for (const v of [draft, hidden, deleted]) expect(await env.stats.record(v.id, 'whatsapp')).toBe(false);
    expect((await env.stats.overview()).views + (await env.stats.overview()).whatsappClicks).toBe(0);
  });

  it('período de 30 dias pelo fuso de Brasília', async () => {
    const vehicle = await env.vehicles.create(vehicleInput(), actor);
    const at = (iso: string) => new StatsService(new StatsRepository(env.db), () => new Date(iso));
    await at('2026-08-01T12:00:00Z').record(vehicle.id, 'view'); // fora da janela
    await at('2026-09-01T02:30:00Z').record(vehicle.id, 'view'); // 31/08 em Brasília — fora
    await at('2026-09-01T12:00:00Z').record(vehicle.id, 'view'); // 01/09 — dentro
    await at('2026-09-30T12:00:00Z').record(vehicle.id, 'whatsapp');
    expect(await at('2026-09-30T15:00:00Z').forVehicle(vehicle.id)).toEqual({ views: 1, whatsappClicks: 1 });
  });
});
