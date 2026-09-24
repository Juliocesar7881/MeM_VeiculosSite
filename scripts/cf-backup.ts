/**
 * Backup da produção no Cloudflare (usa o Wrangler já autenticado):
 *   - banco D1 exportado em SQL
 *   - todas as fotos (KV ou R2) referenciadas no banco
 *
 *   npm run cf:backup
 *   npm run cf:restore -- backups/cf-2026-09-24T12-00-00               (banco VAZIO + fotos)
 *   npm run cf:restore -- backups/cf-2026-09-24T12-00-00 --media-only  (só fotos; ex.: migrar KV -> R2)
 *
 * O d1.sql contém CREATE TABLE: a restauração completa só funciona num banco D1 novo/vazio.
 * Para voltar o banco atual a um momento anterior, use o Time Travel (docs/BACKUP.md).
 *
 * Saída: backups/cf-AAAA-MM-DDTHH-MM-SS/{d1.sql, media/...}
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { contentTypeForKey } from '../src/lib/storage/keys';

// Binding do wrangler.jsonc: os comandos seguem o banco configurado lá (database_name/id).
const DB_NAME = 'DB';
const shell = process.platform === 'win32';

/** No Windows o spawn usa o shell: argumentos com espaço precisam de aspas. */
function quote(arg: string): string {
  return shell && /[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function wrangler(args: string[], capture = false): string {
  const result = spawnSync('npx', ['wrangler', ...args.map(quote)], {
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

/** Executa o wrangler capturando a saída binária (valor de uma chave do KV). */
function wranglerBinary(args: string[]): Buffer {
  const result = spawnSync('npx', ['wrangler', ...args.map(quote)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(`✖ wrangler ${args.join(' ')}\n${result.stderr.toString()}`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
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
  // Duas consultas simples (o D1 limita o número de termos em UNION).
  const sql =
    'SELECT large_key, thumb_key, medium_key, og_key FROM vehicle_images; ' +
    'SELECT large_key, thumb_key FROM vehicle_lead_images';
  const out = wrangler(['d1', 'execute', DB_NAME, '--remote', '--json', '--command', sql], true);
  const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: Record<string, string | null>[] }[];
  const keys = parsed.flatMap((r) => r.results.flatMap((row) => Object.values(row)));
  return [...new Set(keys.filter((k): k is string => Boolean(k)))];
}

function backup() {
  const { kvId, r2Bucket, driver } = readConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Caminho relativo: o wrangler roda na raiz do projeto.
  const dir = path.join('backups', `cf-${stamp}`);
  mkdirSync(dir, { recursive: true });

  wrangler(['d1', 'export', DB_NAME, '--remote', '--output', path.join(dir, 'd1.sql')]);
  const keys = mediaKeys();
  for (const key of keys) {
    const file = path.join(dir, 'media', ...key.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    if (driver === 'r2' && r2Bucket) {
      wrangler(['r2', 'object', 'get', `${r2Bucket}/${key}`, '--remote', '--file', file]);
    } else if (kvId) {
      writeFileSync(file, wranglerBinary(['kv', 'key', 'get', key, '--namespace-id', kvId, '--remote']));
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

function restore(source: string, mediaOnly: boolean) {
  const { kvId, r2Bucket, driver } = readConfig();
  const dir = path.relative(process.cwd(), path.resolve(source));
  if (!existsSync(dir)) {
    console.error(`✖ Pasta de backup não encontrada: ${dir}`);
    process.exit(1);
  }
  if (!mediaOnly) {
    wrangler(['d1', 'execute', DB_NAME, '--remote', '--yes', '--file', path.join(dir, 'd1.sql')]);
  }
  const mediaDir = path.join(dir, 'media');
  const files = listFiles(mediaDir);
  for (const file of files) {
    const key = path.relative(mediaDir, file).split(path.sep).join('/');
    if (driver === 'r2' && r2Bucket) {
      const type = contentTypeForKey(key);
      wrangler(['r2', 'object', 'put', `${r2Bucket}/${key}`, '--remote', '--file', file, '--content-type', type]);
    } else if (kvId) {
      const metadata = JSON.stringify({ contentType: contentTypeForKey(key), size: statSync(file).size });
      wrangler(['kv', 'key', 'put', key, '--namespace-id', kvId, '--remote', '--path', file, '--metadata', metadata]);
    }
  }
  const target = driver === 'r2' && r2Bucket ? `R2 (${r2Bucket})` : 'KV';
  console.log(`\n✔ Restaurado: ${mediaOnly ? '' : 'banco + '}${files.length} arquivos de foto no ${target}.`);
}

const [task, ...args] = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith('--'));
if (task === 'backup') backup();
else if (task === 'restore' && folder) restore(folder, args.includes('--media-only'));
else {
  console.error('Uso: tsx scripts/cf-backup.ts backup | restore <pasta> [--media-only]');
  process.exit(1);
}
