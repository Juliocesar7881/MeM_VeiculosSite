/**
 * Apaga o banco e as fotos LOCAIS de desenvolvimento e reaplica as migrations.
 * Nunca atua sobre bancos remotos.
 */
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createLibsqlDatabase } from '../src/lib/db/libsql';
import { applyMigrations } from '../src/lib/db/migrator';
import { loadEnv } from './lib/env';
import { loadMigrationFiles } from './lib/migrations';

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL || 'file:.data/dev.db';
  if (!url.startsWith('file:')) {
    console.error('✖ db:reset só funciona com banco local (file:). Abortado.');
    process.exit(1);
  }
  const file = path.resolve(url.slice('file:'.length));
  const dataDir = path.resolve('.data');
  if (!file.startsWith(dataDir)) {
    console.error('✖ Por segurança, o banco local precisa estar dentro de .data/. Abortado.');
    process.exit(1);
  }
  await Promise.all([
    rm(file, { force: true }),
    rm(`${file}-wal`, { force: true }),
    rm(`${file}-shm`, { force: true }),
    rm(path.resolve(process.env.LOCAL_STORAGE_DIR || '.data/uploads'), { recursive: true, force: true }),
  ]);
  const db = await createLibsqlDatabase({ url });
  await applyMigrations(db, await loadMigrationFiles(), (m) => console.log(m));
  await db.close();
  console.log('Banco local recriado. Rode "npm run db:seed:demo" para dados de demonstração.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
