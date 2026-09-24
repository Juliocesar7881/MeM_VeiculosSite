/**
 * Aplica as migrations pendentes no banco configurado em DATABASE_URL.
 *   Local:    npm run db:migrate
 *   Produção: DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate
 * Na Vercel, roda automaticamente no build (script "vercel-build").
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createLibsqlDatabase } from '../src/lib/db/libsql';
import { applyMigrations } from '../src/lib/db/migrator';
import { isLocalDatabase, loadEnv } from './lib/env';
import { loadMigrationFiles } from './lib/migrations';

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL || 'file:.data/dev.db';

  if (process.env.VERCEL && isLocalDatabase(url)) {
    console.error(
      '✖ Build na Vercel com DATABASE_URL local. Configure o Turso (libsql://...) nas variáveis de ambiente do projeto.',
    );
    process.exit(1);
  }

  if (url.startsWith('file:')) {
    await mkdir(path.dirname(path.resolve(url.slice('file:'.length))), { recursive: true });
  }

  const db = await createLibsqlDatabase({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const target = isLocalDatabase(url) ? url : new URL(url.replace(/^libsql:/, 'https:')).host;
  console.log(`Aplicando migrations em ${target}`);
  await applyMigrations(db, await loadMigrationFiles(), (msg) => console.log(msg));
  await db.close();
}

main().catch((error: unknown) => {
  console.error('✖ Falha ao aplicar migrations:', error);
  process.exit(1);
});
