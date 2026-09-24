/**
 * Backup completo: banco (JSON + SQL) e, opcionalmente, todas as fotos.
 *
 *   npm run db:backup                 -> banco
 *   npm run db:backup -- --with-media -> banco + fotos (vehicles/ e sell-leads/)
 *
 * Usa as variáveis de ambiente atuais (DATABASE_URL, STORAGE_DRIVER...). Para fazer backup
 * da PRODUÇÃO, exporte as variáveis de produção antes de rodar (veja docs/BACKUP.md).
 * Saída: backups/AAAA-MM-DDTHH-MM-SS/
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from './lib/env';
import { connectFromEnv, DATA_TABLES, sqlLiteral } from './lib/services';

async function streamToBuffer(body: ReadableStream<Uint8Array> | Uint8Array): Promise<Buffer> {
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function main() {
  loadEnv();
  const withMedia = process.argv.includes('--with-media');
  const { db, storage, dbUrl } = await connectFromEnv();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.resolve('backups', stamp);
  await mkdir(dir, { recursive: true });

  const data: Record<string, Record<string, unknown>[]> = {};
  const sql: string[] = ['-- Backup M&M Veículos', `-- Gerado em ${new Date().toISOString()}`, ''];
  for (const table of DATA_TABLES) {
    const rows = await db.all<Record<string, unknown>>(`SELECT * FROM ${table}`);
    data[table] = rows;
    for (const row of rows) {
      const columns = Object.keys(row);
      sql.push(
        `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((c) => sqlLiteral(row[c])).join(', ')});`,
      );
    }
    console.log(`✔ ${table}: ${rows.length} registro(s)`);
  }
  const migrations = await db.all<{ name: string }>('SELECT name FROM d1_migrations ORDER BY id');
  await writeFile(
    path.join(dir, 'database.json'),
    JSON.stringify(
      { createdAt: new Date().toISOString(), source: dbUrl.replace(/\?.*$/, ''), migrations, data },
      null,
      2,
    ),
  );
  await writeFile(path.join(dir, 'database.sql'), `${sql.join('\n')}\n`);

  if (withMedia) {
    const keys = new Set<string>();
    for (const table of ['vehicle_images', 'vehicle_lead_images']) {
      for (const row of data[table] ?? []) {
        keys.add(String(row.large_key));
        keys.add(String(row.thumb_key));
        if (row.og_key) keys.add(String(row.og_key));
        if (row.medium_key) keys.add(String(row.medium_key));
      }
    }
    let saved = 0;
    for (const key of keys) {
      const object = await storage.get(key);
      if (!object) {
        console.warn(`⚠ arquivo ausente no storage: ${key}`);
        continue;
      }
      const target = path.join(dir, 'media', ...key.split('/'));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await streamToBuffer(object.body));
      saved += 1;
    }
    console.log(`✔ fotos: ${saved}/${keys.size}`);
  }

  await db.close();
  console.log(`\nBackup salvo em ${dir}`);
  console.log('Guarde esta pasta em local seguro (contém dados pessoais de propostas — LGPD).');
}

main().catch((error: unknown) => {
  console.error('✖ Falha no backup:', error);
  process.exit(1);
});
