/**
 * Sobe o site para os testes E2E com banco e uploads ISOLADOS (.data/e2e*),
 * dados de demonstração e uma senha de painel exclusiva de teste.
 * Usado pelo Playwright (playwright.config.ts -> webServer).
 */
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { hashPassword, toBase64Url } from '../src/lib/auth/password';
import { createLibsqlDatabase } from '../src/lib/db/libsql';
import { applyMigrations } from '../src/lib/db/migrator';
import { loadMigrationFiles } from './lib/migrations';

export const E2E_PORT = Number(process.env.E2E_PORT ?? 4322);
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-senha-de-teste-123';

async function main() {
  const dbFile = path.resolve('.data/e2e.db');
  const uploads = path.resolve('.data/e2e-uploads');
  await Promise.all([
    rm(dbFile, { force: true }),
    rm(`${dbFile}-wal`, { force: true }),
    rm(`${dbFile}-shm`, { force: true }),
    rm(uploads, { recursive: true, force: true }),
  ]);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: 'file:.data/e2e.db',
    LOCAL_STORAGE_DIR: '.data/e2e-uploads',
    STORAGE_DRIVER: 'local',
    AUTH_MODE: 'password',
    ADMIN_PASSWORD_HASH: await hashPassword(E2E_ADMIN_PASSWORD, 100_000),
    SESSION_SECRET: toBase64Url(crypto.getRandomValues(new Uint8Array(48))),
    IP_HASH_SALT: 'e2e',
    TURNSTILE_SITE_KEY: '',
    TURNSTILE_SECRET_KEY: '',
    ALLOW_INDEXING: 'false',
    PUBLIC_SITE_URL: '',
  };

  const db = await createLibsqlDatabase({ url: env.DATABASE_URL as string });
  await applyMigrations(db, await loadMigrationFiles());
  await db.close();

  const run = (command: string, args: string[]) =>
    spawn(command, args, { env, stdio: 'inherit', shell: process.platform === 'win32' });

  await new Promise<void>((resolve, reject) => {
    run('npx', ['tsx', 'scripts/seed-demo.ts']).on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`seed saiu com ${code}`)),
    );
  });

  const server = run('npx', ['astro', 'dev', '--port', String(E2E_PORT), '--host', '127.0.0.1']);
  const stop = () => server.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  server.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
