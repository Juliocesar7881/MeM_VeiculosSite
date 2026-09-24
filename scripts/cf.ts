/**
 * Atalhos do Cloudflare (funciona igual no Windows, macOS e Linux).
 *
 *   npm run cf:build          -> build para Workers (DEPLOY_TARGET=cloudflare)
 *   npm run cf:deploy         -> migrations remotas + build + wrangler deploy
 *   npm run cf:dev            -> astro dev dentro do workerd (D1/KV locais simulados)
 *   npm run cf:migrate        -> aplica migrations no D1 remoto
 *   npm run cf:migrate:local  -> aplica migrations no D1 local (cf:dev)
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

// Binding do wrangler.jsonc: os comandos seguem o banco configurado lá (database_name/id).
const DB_NAME = 'DB';
const env = { ...process.env, DEPLOY_TARGET: 'cloudflare' };
const shell = process.platform === 'win32';

function run(command: string, args: string[]) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { env, stdio: 'inherit', shell });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const task = process.argv[2];
switch (task) {
  case 'build':
    run('npx', ['astro', 'build']);
    break;
  case 'deploy':
    run('npx', ['wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--remote']);
    run('npx', ['astro', 'build']);
    // Arquivo de variáveis LOCAIS gerado para preview — nunca faz parte do deploy.
    rmSync('dist/server/.dev.vars', { force: true });
    run('npx', ['wrangler', 'deploy']);
    break;
  case 'dev':
    run('npx', ['wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--local']);
    run('npx', ['astro', 'dev']);
    break;
  case 'migrate':
    run('npx', ['wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--remote']);
    break;
  case 'migrate:local':
    run('npx', ['wrangler', 'd1', 'migrations', 'apply', DB_NAME, '--local']);
    break;
  default:
    console.error('Uso: tsx scripts/cf.ts <build|deploy|dev|migrate|migrate:local>');
    process.exit(1);
}
