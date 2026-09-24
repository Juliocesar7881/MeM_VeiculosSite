import path from 'node:path';
import { createClient, type Client, type InValue } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createD1Database } from '@/lib/db/d1';
import { applyMigrations } from '@/lib/db/migrator';
import { KvStorage } from '@/lib/storage/kv';
import { R2Storage } from '@/lib/storage/r2';
import { DEFAULT_SETTINGS } from '@/config/site';
import { parseInventoryFilters } from '@/schemas/filters';
import { buildServices } from '@/server/services';
import { loadMigrationFiles } from '../../scripts/lib/migrations';
import { actor, vehicleInput } from '../helpers/env';
import { makeImage, makePair } from '../helpers/images';

/** D1 simulado: mesma API do binding do Workers, executando em SQLite real (libSQL em memória). */
function fakeD1(client: Client): CfD1Database {
  const toResult = (rs: Awaited<ReturnType<Client['execute']>>) => ({
    results: rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]]))),
    success: true,
    meta: { changes: rs.rowsAffected, last_row_id: 0, duration: 0 },
  });
  const statement = (sql: string, args: unknown[] = []): CfD1PreparedStatement & { sql: string; args: unknown[] } => ({
    sql,
    args,
    bind: (...values: unknown[]) => statement(sql, values),
    all: async <T>() => toResult(await client.execute({ sql, args: args as InValue[] })) as never as CfD1Result<T>,
    first: async <T>() =>
      (toResult(await client.execute({ sql, args: args as InValue[] })).results[0] ?? null) as T | null,
    run: async () => toResult(await client.execute({ sql, args: args as InValue[] })),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      const list = statements as unknown as { sql: string; args: unknown[] }[];
      const results = await client.batch(
        list.map((s) => ({ sql: s.sql, args: s.args as InValue[] })),
        'write',
      );
      return results.map(toResult);
    },
    exec: async (sql) => client.executeMultiple(sql),
  };
}

/** KV simulado (Map em memória) com metadados, como o binding real. */
function fakeKv(): CfKVNamespace & { size: () => number } {
  const store = new Map<string, { value: Uint8Array<ArrayBuffer>; metadata: unknown }>();
  const toBytes = (v: ArrayBuffer | Uint8Array | string): Uint8Array<ArrayBuffer> =>
    typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v);
  const kv = {
    size: () => store.size,
    get: async (key: string) => {
      const item = store.get(key);
      return item ? item.value.slice().buffer : null;
    },
    getWithMetadata: async (key: string, options: { type: 'stream' | 'arrayBuffer' }) => {
      const item = store.get(key);
      if (!item) return { value: null, metadata: null };
      const value = options.type === 'stream' ? new Blob([item.value.slice()]).stream() : item.value.slice().buffer;
      return { value, metadata: item.metadata };
    },
    put: async (key: string, value: ArrayBuffer | Uint8Array | string, options?: { metadata?: unknown }) => {
      store.set(key, { value: toBytes(value), metadata: options?.metadata ?? null });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
  return kv as unknown as CfKVNamespace & { size: () => number };
}

function fakeR2(): CfR2Bucket {
  type Item = { value: Uint8Array<ArrayBuffer>; httpMetadata?: { contentType?: string } };
  const store = new Map<string, Item>();
  const object = (item: Item): CfR2Object => ({
    body: new Blob([item.value]).stream(),
    size: item.value.byteLength,
    httpEtag: `"${item.value.byteLength}"`,
    httpMetadata: item.httpMetadata,
    arrayBuffer: async () => item.value.slice().buffer,
  });
  return {
    get: async (key) => {
      const item = store.get(key);
      return item ? object(item) : null;
    },
    put: async (key, value, options) => {
      store.set(key, { value: new Uint8Array(value), httpMetadata: options?.httpMetadata });
    },
    delete: async (keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
    },
  };
}

async function readAll(body: ReadableStream<Uint8Array> | Uint8Array): Promise<number> {
  if (body instanceof Uint8Array) return body.byteLength;
  return (await new Response(body).arrayBuffer()).byteLength;
}

describe('adaptador D1 + storage KV (como no Cloudflare Workers)', () => {
  let client: Client;
  let kv: ReturnType<typeof fakeKv>;
  let services: ReturnType<typeof buildServices>;

  beforeEach(async () => {
    client = createClient({ url: ':memory:', intMode: 'number' });
    const db = createD1Database(fakeD1(client));
    await applyMigrations(db, await loadMigrationFiles(path.resolve(process.cwd(), 'migrations')));
    kv = fakeKv();
    services = buildServices({ db, storage: new KvStorage(kv), ipHashSalt: 'cf' });
  });
  afterEach(() => client.close());

  it('fluxo completo: cadastro, fotos (média + compartilhamento), busca, oferta e exclusão', async () => {
    const vehicle = await services.vehicles.create(vehicleInput({ isOffer: 'on', previousPrice: '124.900' }), actor);
    const pair = await makePair();
    const medium = await makeImage(1080, 810);
    const og = await makeImage(1200, 630, 'jpeg');
    const image = await services.media.addVehicleImage(vehicle.id, { ...pair, medium, og }, actor);
    expect(image.ogKey).toBe(`vehicles/${vehicle.id}/${image.id}-og.jpg`);
    expect(image.mediumKey).toBe(`vehicles/${vehicle.id}/${image.id}-md.webp`);
    expect(image.mediumWidth).toBe(1080);
    expect(kv.size()).toBe(4);
    expect(await services.media.getPublicVehicleObject(image.mediumKey!)).not.toBeNull();

    const stored = await services.media.getPublicVehicleObject(image.largeKey);
    expect(stored?.contentType).toBe('image/webp');
    expect(await readAll(stored!.body)).toBe(pair.large.byteLength);

    const result = await services.vehicles.search(parseInventoryFilters(new URLSearchParams('oferta=true')), {
      ...DEFAULT_SETTINGS,
    });
    expect(result.items.map((v) => v.id)).toEqual([vehicle.id]);
    expect(result.items[0]?.cover?.largeKey).toBe(image.largeKey);
    expect(result.items[0]?.cover?.mediumKey).toBe(image.mediumKey);
    expect(result.items[0]?.cover?.mediumWidth).toBe(1080);

    await services.vehicles.quickAction(vehicle.id, 'delete', actor);
    expect(kv.size()).toBe(0);
  });

  it('proposta convertida copia as fotos dentro do KV', async () => {
    const { leadInputSchema } = await import('@/schemas/lead');
    const lead = leadInputSchema.parse({
      name: 'Cliente Workers',
      whatsapp: '47999990000',
      category: 'moto',
      brand: 'Honda',
      model: 'Biz',
      manufactureYear: '2022',
      consent: 'on',
    });
    const leadId = await services.leads.submit(lead, [await makePair()], { ipHash: null });
    const vehicle = await services.leads.convertToVehicle(leadId, actor);
    const detail = await services.vehicles.getDetail(vehicle.id);
    expect(detail?.images[0]?.largeKey.startsWith(`vehicles/${vehicle.id}/`)).toBe(true);
    expect(detail?.images[0]?.ogKey).toBeNull();
    expect(detail?.images[0]?.mediumKey).toBeNull();
    expect(kv.size()).toBe(4); // 2 da proposta + 2 copiadas
  });

  it('cota diária do KV esgotada: mensagem clara no painel e proposta salva sem fotos', async () => {
    const full = fakeKv();
    let writes = 0;
    const put = full.put.bind(full);
    full.put = (async (...args: Parameters<typeof put>) => {
      writes += 1;
      if (writes > 1) throw new Error('KV put() limit exceeded for the day.');
      return put(...args);
    }) as typeof full.put;
    const db = createD1Database(fakeD1(client));
    const limited = buildServices({ db, storage: new KvStorage(full), ipHashSalt: 'cf' });

    const vehicle = await limited.vehicles.create(vehicleInput(), actor);
    const upload = limited.media.addVehicleImage(vehicle.id, await makePair(), actor);
    await expect(upload).rejects.toMatchObject({ status: 507, message: expect.stringMatching(/Limite diário/) });
    expect(full.size()).toBe(0); // a foto grande gravada antes do erro foi removida

    const { leadInputSchema } = await import('@/schemas/lead');
    const lead = leadInputSchema.parse({
      name: 'Cliente Cota',
      whatsapp: '47999990001',
      category: 'carro',
      brand: 'Fiat',
      model: 'Uno',
      manufactureYear: '2015',
      consent: 'on',
    });
    const leadId = await limited.leads.submit(lead, [await makePair()], { ipHash: null });
    const detail = await limited.leads.getDetail(leadId);
    expect(detail?.images).toHaveLength(0);
    expect(detail?.adminNotes).toMatch(/Peça as fotos pelo WhatsApp/);
    expect(full.size()).toBe(0);
  });

  it('rate limit (INSERT ... ON CONFLICT ... RETURNING) funciona no adaptador', async () => {
    const rule = { bucket: 't', limit: 1, windowSeconds: 60 };
    expect((await services.rateLimiter.check(rule, '1.1.1.1')).allowed).toBe(true);
    expect((await services.rateLimiter.check(rule, '1.1.1.1')).allowed).toBe(false);
  });
});

describe('storage R2 (binding)', () => {
  it('put/get/copy/delete com content-type', async () => {
    const storage = new R2Storage(fakeR2());
    const data = new Uint8Array([1, 2, 3, 4]);
    await storage.put('vehicles/a/b.webp', data, { contentType: 'image/webp' });
    await storage.copy('vehicles/a/b.webp', 'vehicles/a/c.webp');
    const copy = await storage.get('vehicles/a/c.webp');
    expect(copy?.contentType).toBe('image/webp');
    expect(await readAll(copy!.body)).toBe(4);
    await storage.delete(['vehicles/a/b.webp', 'vehicles/a/c.webp']);
    expect(await storage.get('vehicles/a/b.webp')).toBeNull();
  });
});
