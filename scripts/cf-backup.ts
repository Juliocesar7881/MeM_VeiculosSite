/**
 * Backup da produção no Cloudflare (usa o Wrangler já autenticado):
 *   - banco D1 exportado em SQL
 *   - todas as fotos (KV ou R2) referenciadas no banco
 *
 *   npm run cf:backup
 *   npm run cf:restore -- backups/cf-2026-09-24T12-00-00      (restaura banco + fotos num D1 vazio)
 *   npm run cf:restore -- backups/cf-... --media-only         (só as fotos — ex.: migrar do KV para o R2)
 *
 * Saída: backups/cf-AAAA-MM-DDTHH-MM-SS/{d1.sql, media/...}
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DB_NAME = 'mm-veiculos';
const shell = process.platform === 'win32';

/** Com shell (Windows) o argumento precisa de aspas; sem shell, vai literalmente. */
function shellArg(value: string): string {
  return shell ? `"${value}"` : value;
}

function wrangler(args: string[], capture = false): string {
  const result = spawnSync('npx', ['wrangler', ...args], {
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    shell,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(`✖ wrangler ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
  return capture ? result.stdout : '';
}

/** Lê o wrangler.jsonc (JSON com comentários) para descobrir o storage em uso. */
function readConfig(): { kvId?: string; r2Bucket?: string; driver: string } {
  const raw = readFileSync('wrangler.jsonc', 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const config = JSON.parse(raw) as {
    kv_namespaces?: { binding: string; id: string }[];
    r2_buckets?: { binding: string; bucket_name: string }[];
    vars?: Record<string, string>;
  };
  return {
    kvId: config.kv_namespaces?.find((k) => k.binding === 'MEDIA_KV')?.id,
    r2Bucket: config.r2_buckets?.find((b) => b.binding === 'MEDIA')?.bucket_name,
    driver: config.vars?.STORAGE_DRIVER ?? 'kv',
  };
}

function mediaKeys(): string[] {
  const sql =
    'SELECT large_key AS k FROM vehicle_images UNION SELECT thumb_key FROM vehicle_images ' +
    'UNION SELECT og_key FROM vehicle_images WHERE og_key IS NOT NULL ' +
    'UNION SELECT large_key FROM vehicle_lead_images UNION SELECT thumb_key FROM vehicle_lead_images';
  const out = wrangler(['d1', 'execute', DB_NAME, '--remote', '--json', '--command', shellArg(sql)], true);
  const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: { k: string }[] }[];
  return parsed.flatMap((r) => r.results.map((row) => row.k)).filter(Boolean);
}

function backup() {
  const { kvId, r2Bucket, driver } = readConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.resolve('backups', `cf-${stamp}`);
  mkdirSync(dir, { recursive: true });

  wrangler(['d1', 'export', DB_NAME, '--remote', '--output', path.join(dir, 'd1.sql')]);
  const keys = mediaKeys();
  for (const key of keys) {
    const file = path.join(dir, 'media', ...key.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    if (driver === 'r2' && r2Bucket) {
      wrangler(['r2', 'object', 'get', `${r2Bucket}/${key}`, '--remote', '--file', file]);
    } else if (kvId) {
      wrangler(['kv', 'key', 'get', key, '--namespace-id', kvId, '--remote', '--file', file]);
    }
  }
  console.log(`\n✔ Backup salvo em ${dir} (${keys.length} arquivos de foto).`);
  console.log('Contém dados pessoais de propostas — guarde em local seguro (LGPD).');
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function databaseHasTables(): boolean {
  const out = wrangler(
    [
      'd1',
      'execute',
      DB_NAME,
      '--remote',
      '--json',
      '--command',
      shellArg("SELECT name FROM sqlite_master WHERE name = 'vehicles'"),
    ],
    true,
  );
  const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: unknown[] }[];
  return parsed.some((r) => r.results.length > 0);
}

function restore(source: string, mediaOnly: boolean) {
  const { kvId, r2Bucket, driver } = readConfig();
  const dir = path.resolve(source);
  if (!mediaOnly) {
    if (databaseHasTables()) {
      console.error(
        '✖ O D1 "mm-veiculos" já tem dados. O SQL do backup recria as tabelas e só pode ser aplicado num banco vazio.\n' +
          '  • Para voltar no tempo, use o Time Travel: npx wrangler d1 time-travel restore mm-veiculos --timestamp=<ISO>\n' +
          '  • Para copiar só as fotos, rode de novo com --media-only.',
      );
      process.exit(1);
    }
    wrangler(['d1', 'execute', DB_NAME, '--remote', '--file', path.join(dir, 'd1.sql')]);
  }
  const mediaDir = path.join(dir, 'media');
  const files = listFiles(mediaDir);
  for (const file of files) {
    const key = path.relative(mediaDir, file).split(path.sep).join('/');
    if (driver === 'r2' && r2Bucket) {
      wrangler(['r2', 'object', 'put', `${r2Bucket}/${key}`, '--remote', '--file', file]);
    } else if (kvId) {
      const metadata = shellArg(JSON.stringify({ contentType: contentType(key), size: statSync(file).size }));
      wrangler(['kv', 'key', 'put', key, '--namespace-id', kvId, '--remote', '--path', file, '--metadata', metadata]);
    }
  }
  console.log(`\n✔ Restaurado: ${mediaOnly ? '' : 'banco + '}${files.length} arquivos de foto.`);
}

function contentType(key: string): string {
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

const [task, arg] = process.argv.slice(2);
if (task === 'backup') backup();
else if (task === 'restore' && arg) restore(arg, process.argv.includes('--media-only'));
else {
  console.error('Uso: tsx scripts/cf-backup.ts backup | restore <pasta> [--media-only]');
  process.exit(1);
}
