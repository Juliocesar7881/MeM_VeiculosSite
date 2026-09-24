import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MigrationFile } from '../../src/lib/db/migrator';

export async function loadMigrationFiles(dir = path.resolve(process.cwd(), 'migrations')): Promise<MigrationFile[]> {
  const names = (await readdir(dir)).filter((n) => /^\d{4}_.+\.sql$/.test(n)).sort();
  return Promise.all(names.map(async (name) => ({ name, sql: await readFile(path.join(dir, name), 'utf8') })));
}
