/**
 * Restaura um backup gerado por "npm run db:backup".
 *
 *   npm run db:restore -- backups/2026-09-24T12-00-00            -> banco
 *   npm run db:restore -- backups/2026-09-24T12-00-00 --with-media -> banco + fotos
 *
 * O banco de destino (DATABASE_URL) recebe as migrations e depois os dados
 * (INSERT OR REPLACE — registros existentes com o mesmo id são substituídos).
 * Exige --yes para confirmar quando o destino não é o banco local.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { applyMigrations } from '../src/lib/db/migrator';
import type { SqlStatement, SqlValue } from '../src/lib/db/types';
import { contentTypeForKey } from '../src/lib/storage/keys';
import { isLocalDatabase, loadEnv } from './lib/env';
import { loadMigrationFiles } from './lib/migrations';
import { connectFromEnv, DATA_TABLES } from './lib/services';

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

async function main() {
  loadEnv();
  const source = process.argv[2];
  if (!source || source.startsWith('--')) {
    console.error('Uso: npm run db:restore -- <pasta-do-backup> [--with-media] [--yes]');
    process.exit(1);
  }
  const dir = path.resolve(source);
  const { db, storage, dbUrl } = await connectFromEnv();
  if (!isLocalDatabase(dbUrl) && !process.argv.includes('--yes')) {
    console.error('✖ Destino remoto. Revise DATABASE_URL e rode novamente com --yes para confirmar.');
    process.exit(1);
  }

  const backup = JSON.parse(await readFile(path.join(dir, 'database.json'), 'utf8')) as {
    data: Record<string, Record<string, SqlValue>[]>;
  };
  await applyMigrations(db, await loadMigrationFiles(), (m) => console.log(m));

  for (const table of DATA_TABLES) {
    const rows = backup.data[table] ?? [];
    const statements: SqlStatement[] = rows.map((row) => {
      const columns = Object.keys(row);
      return {
        sql: `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        args: columns.map((c) => row[c] ?? null),
      };
    });
    for (let i = 0; i < statements.length; i += 200) await db.batch(statements.slice(i, i + 200));
    console.log(`✔ ${table}: ${rows.length}`);
  }

  if (process.argv.includes('--with-media')) {
    const mediaDir = path.join(dir, 'media');
    const files = await listFiles(mediaDir).catch(() => [] as string[]);
    for (const file of files) {
      const key = path.relative(mediaDir, file).split(path.sep).join('/');
      await storage.delete([key]).catch(() => undefined);
      await storage.put(key, new Uint8Array(await readFile(file)), { contentType: contentTypeForKey(key) });
    }
    console.log(`✔ fotos restauradas: ${files.length}`);
  }
  await db.close();
  console.log('Restauração concluída.');
}

main().catch((error: unknown) => {
  console.error('✖ Falha na restauração:', error);
  process.exit(1);
});
