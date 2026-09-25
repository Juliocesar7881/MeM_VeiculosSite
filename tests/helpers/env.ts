import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLibsqlDatabase } from '@/lib/db/libsql';
import { applyMigrations } from '@/lib/db/migrator';
import { LocalStorage } from '@/lib/storage/local';
import { vehicleInputSchema, type VehicleInput } from '@/schemas/vehicle';
import { buildServices, type Services } from '@/server/services';
import type { AdminActor } from '@/types/domain';
import { loadMigrationFiles } from '../../scripts/lib/migrations';

export const actor: AdminActor = { id: 'test', label: 'Teste', method: 'password' };

export interface TestEnv extends Services {
  storageDir: string;
  cleanup: () => Promise<void>;
}

/** Banco SQLite em memória com as migrations reais + storage em diretório temporário. */
export async function createTestEnv(): Promise<TestEnv> {
  const db = await createLibsqlDatabase({ url: ':memory:' });
  await applyMigrations(db, await loadMigrationFiles(path.resolve(process.cwd(), 'migrations')));
  const storageDir = await mkdtemp(path.join(os.tmpdir(), 'mm-test-'));
  const storage = new LocalStorage(storageDir);
  const services = buildServices({ db, storage, ipHashSalt: 'test-salt' });
  return {
    ...services,
    storageDir,
    cleanup: async () => {
      await db.close();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
}

export function vehicleInput(overrides: Record<string, unknown> = {}): VehicleInput {
  return vehicleInputSchema.parse({
    category: 'carro',
    brand: 'Toyota',
    model: 'Corolla',
    version: 'XEi 2.0',
    manufactureYear: '2021',
    modelYear: '2022',
    price: '118.900',
    mileage: '40.000',
    fuel: 'flex',
    transmission: 'cvt',
    status: 'available',
    commercialType: 'normal',
    features: ['Ar-condicionado'],
    ...overrides,
  });
}
