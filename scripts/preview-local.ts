/**
 * Build de PRODUÇÃO rodando localmente (adapter Node), com o banco/fotos do .env.
 * Serve para conferir o site como ele fica publicado e medir com Lighthouse.
 *
 *   npm run preview:local        -> http://localhost:4330
 */
import { spawn } from 'node:child_process';
import { loadEnv } from './lib/env';

loadEnv();
const port = process.env.PREVIEW_PORT ?? '4330';
const env: NodeJS.ProcessEnv = { ...process.env, ADAPTER: 'node' };
const shell = process.platform === 'win32';

const build = spawn('npx', ['astro', 'build'], { env, stdio: 'inherit', shell });
build.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  console.log(`\nServidor de produção local: http://localhost:${port}\n`);
  const server = spawn('node', ['dist/server/entry.mjs'], {
    env: { ...env, HOST: '127.0.0.1', PORT: port, NODE_ENV: 'production' },
    stdio: 'inherit',
  });
  server.on('exit', (c) => process.exit(c ?? 0));
});
