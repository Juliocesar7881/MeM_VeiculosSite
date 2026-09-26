/**
 * Migra as fotos do Workers KV para o R2 SEM tirar nada do KV (cópia), conferindo byte a byte.
 *
 *   npm run cf:migrate-media            -> copia as fotos que faltam no R2 e confere
 *   npm run cf:migrate-media -- --check -> só confere (não copia)
 *
 * Com o Worker em STORAGE_DRIVER=r2 e o binding MEDIA_KV ainda configurado, o site lê do KV tudo o que
 * não estiver no R2 (lib/storage/fallback.ts): a migração pode rodar com o site no ar. No fim, o tamanho
 * registrado de cada foto passa a ser o total real das versões (usado no teto do espaço de fotos).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { contentTypeForKey } from '../src/lib/storage/keys';

const DB_NAME = 'DB';
/** Arquivos em paralelo (cada um usa ~4 chamadas à API; o limite da Cloudflare é 1.200 a cada 5 min). */
const CONCURRENCY = Number(process.env.MIGRATE_CONCURRENCY ?? 6);
const WRANGLER = path.resolve('node_modules/wrangler/bin/wrangler.js');

function readConfig(): { kvId: string; bucket: string } {
  const raw = readFileSync('wrangler.jsonc', 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  const config = JSON.parse(raw) as {
    kv_namespaces?: { binding: string; id: string }[];
    r2_buckets?: { binding: string; bucket_name: string }[];
  };
  const kvId = config.kv_namespaces?.find((k) => k.binding === 'MEDIA_KV')?.id;
  const bucket = config.r2_buckets?.find((b) => b.binding === 'MEDIA')?.bucket_name;
  if (!kvId || !bucket) throw new Error('wrangler.jsonc precisa ter o KV MEDIA_KV e o R2 MEDIA configurados.');
  return { kvId, bucket };
}

function wrangler(args: string[]): Promise<{ code: number; stdout: Buffer; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WRANGLER, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()));
    child.on('close', (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(out), stderr: err }));
  });
}

async function d1Rows<T>(sql: string): Promise<T[]> {
  const { code, stdout, stderr } = await wrangler(['d1', 'execute', DB_NAME, '--remote', '--json', '--command', sql]);
  if (code !== 0) throw new Error(`D1: ${stderr}`);
  return (JSON.parse(stdout.toString()) as { results: T[] }[])[0]?.results ?? [];
}

const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');

async function pool<T>(items: T[], worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index] as T, index);
      }
    }),
  );
}

interface ImageRow {
  table: 'vehicle_images' | 'vehicle_lead_images';
  id: string;
  keys: string[];
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const { kvId, bucket } = readConfig();
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'mm-media-'));

  const vehicleRows = await d1Rows<{
    id: string;
    large_key: string;
    thumb_key: string;
    medium_key: string | null;
    og_key: string | null;
  }>('SELECT id, large_key, thumb_key, medium_key, og_key FROM vehicle_images');
  const leadRows = await d1Rows<{ id: string; large_key: string; thumb_key: string }>(
    'SELECT id, large_key, thumb_key FROM vehicle_lead_images',
  );
  const images: ImageRow[] = [
    ...vehicleRows.map((r) => ({
      table: 'vehicle_images' as const,
      id: r.id,
      keys: [r.large_key, r.thumb_key, r.medium_key, r.og_key].filter((k): k is string => Boolean(k)),
    })),
    ...leadRows.map((r) => ({ table: 'vehicle_lead_images' as const, id: r.id, keys: [r.large_key, r.thumb_key] })),
  ];
  const keys = images.flatMap((i) => i.keys);

  // Tamanho original de cada arquivo (gravado nos metadados do KV pelo site): confere a leitura.
  const listed = await wrangler(['kv', 'key', 'list', '--namespace-id', kvId, '--remote']);
  if (listed.code !== 0) throw new Error(`KV: ${listed.stderr}`);
  const kvSizes = new Map(
    (JSON.parse(listed.stdout.toString()) as { name: string; metadata?: { size?: number } }[]).map((k) => [
      k.name,
      k.metadata?.size ?? null,
    ]),
  );
  console.log(
    `${images.length} fotos no banco (${keys.length} arquivos). ${checkOnly ? 'Conferindo' : 'Copiando'} KV -> R2 "${bucket}"...`,
  );

  const sizes = new Map<string, number>();
  const problems: string[] = [];
  let copied = 0;
  let alreadyThere = 0;

  await pool(keys, async (key, index) => {
    const file = path.join(tmp, `${index}.bin`);
    // No R2 já? (conferência ou cópia retomada)
    const inR2 = await wrangler(['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', file]);
    const r2Bytes = inR2.code === 0 ? await readFile(file).catch(() => null) : null;

    const fromKv = await wrangler(['kv', 'key', 'get', key, '--namespace-id', kvId, '--remote']);
    const kvBytes = fromKv.code === 0 && fromKv.stdout.length > 0 ? fromKv.stdout : null;
    const expected = kvSizes.get(key);
    if (kvBytes && typeof expected === 'number' && kvBytes.length !== expected) {
      problems.push(`${key}: leitura do KV com ${kvBytes.length} bytes (esperado ${expected})`);
      return;
    }

    if (r2Bytes && (!kvBytes || sha(r2Bytes) === sha(kvBytes))) {
      alreadyThere += 1;
      sizes.set(key, r2Bytes.length);
      return;
    }
    if (!kvBytes) {
      problems.push(`${key}: não está no KV nem no R2`);
      return;
    }
    if (checkOnly) {
      problems.push(`${key}: ainda não está no R2`);
      sizes.set(key, kvBytes.length);
      return;
    }
    await writeFile(file, kvBytes);
    const put = await wrangler([
      'r2',
      'object',
      'put',
      `${bucket}/${key}`,
      '--remote',
      '--file',
      file,
      '--content-type',
      contentTypeForKey(key),
      '--cache-control',
      'public, max-age=31536000, immutable',
    ]);
    if (put.code !== 0) {
      problems.push(`${key}: falha ao enviar (${put.stderr.trim().split('\n').pop()})`);
      return;
    }
    // Confere o que ficou no R2
    const check = await wrangler(['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', file]);
    const stored = check.code === 0 ? await readFile(file).catch(() => null) : null;
    if (!stored || sha(stored) !== sha(kvBytes)) {
      problems.push(`${key}: cópia no R2 diferente do KV`);
      return;
    }
    copied += 1;
    sizes.set(key, kvBytes.length);
    if (copied % 25 === 0) console.log(`  ${copied} arquivos copiados...`);
  });

  // Tamanho registrado de cada foto = soma real das versões (teto do espaço de fotos).
  const updates = images
    .filter((image) => image.keys.every((k) => sizes.has(k)))
    .map((image) => {
      const total = image.keys.reduce((sum, k) => sum + (sizes.get(k) ?? 0), 0);
      return `UPDATE ${image.table} SET size_bytes = ${total} WHERE id = '${image.id.replace(/'/g, "''")}';`;
    });
  if (updates.length && !checkOnly) {
    const sqlFile = path.join(tmp, 'sizes.sql');
    await writeFile(sqlFile, updates.join('\n'));
    const applied = await wrangler(['d1', 'execute', DB_NAME, '--remote', '--yes', '--file', sqlFile]);
    if (applied.code !== 0) problems.push(`tamanhos: falha ao atualizar (${applied.stderr.trim().split('\n').pop()})`);
  }
  await rm(tmp, { recursive: true, force: true });

  const totalBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
  console.log(
    `\nJá estavam no R2: ${alreadyThere} · copiados e conferidos agora: ${copied} · problemas: ${problems.length}`,
  );
  console.log(`Espaço total das fotos: ${(totalBytes / 1e6).toFixed(1)} MB`);
  for (const p of problems.slice(0, 30)) console.log(`  ✖ ${p}`);
  if (problems.length) process.exit(1);
  console.log('✔ Todas as fotos do banco estão no R2, idênticas às do KV.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
