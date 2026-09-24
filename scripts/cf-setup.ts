/**
 * Prepara (ou troca) a conta Cloudflare usada pelo site — ex.: uma conta dedicada só à M&M.
 *
 *   npx wrangler login                          (entre com a conta DEDICADA)
 *   npm run cf:setup                            -> mostra a conta logada e as contas acessíveis
 *   npm run cf:setup -- --account=<ID>          -> usa essa conta
 *
 * O que faz:
 *  1. Confere quem está logado no Wrangler (e-mail + contas).
 *  2. Cria na conta escolhida, se ainda não existirem, o banco D1 "mm-veiculos" e o namespace KV das fotos.
 *  3. Grava no wrangler.jsonc o "account_id" (trava os deploys nessa conta) e os IDs do D1 e do KV.
 *
 * Depois: crie o widget Turnstile NESSA conta, ponha a Site Key em wrangler.jsonc → vars.TURNSTILE_SITE_KEY e rode
 * `npm run cf:deploy` e `npm run cf:secrets`.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DB_NAME = 'mm-veiculos';
const KV_BINDING = 'MEDIA_KV';
const CONFIG = 'wrangler.jsonc';
const shell = process.platform === 'win32';

function wrangler(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync('npx', ['wrangler', ...args], {
    env: { ...env, WRANGLER_SEND_METRICS: 'false' },
    stdio: ['inherit', 'pipe', 'inherit'],
    shell,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(`✖ wrangler ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

/** Extrai o primeiro JSON (objeto ou lista) da saída do Wrangler, ignorando avisos. */
function parseJson<T>(output: string): T {
  const start = output.search(/[[{]/);
  if (start < 0) throw new Error(`Saída inesperada do Wrangler:\n${output}`);
  return JSON.parse(output.slice(start)) as T;
}

interface WhoAmI {
  email?: string;
  accounts?: { id: string; name: string }[];
}

function main() {
  const accountArg = process.argv
    .find((a) => a.startsWith('--account='))
    ?.split('=')[1]
    ?.trim();

  const who = parseJson<WhoAmI>(wrangler(['whoami', '--json']));
  const accounts = who.accounts ?? [];
  console.log(`\nLogado no Wrangler como: ${who.email ?? '(token de API)'}`);
  console.log('Contas acessíveis:');
  for (const a of accounts) console.log(`  • ${a.name}  —  ${a.id}`);

  let account = accountArg ? accounts.find((a) => a.id === accountArg) : undefined;
  if (accountArg && !account) {
    console.error(`\n✖ A conta ${accountArg} não está entre as contas acessíveis por este login.`);
    process.exit(1);
  }
  if (!account) {
    if (accounts.length !== 1) {
      console.error('\nEscolha a conta dedicada ao site e rode de novo: npm run cf:setup -- --account=<ID>');
      process.exit(1);
    }
    account = accounts[0];
  }
  if (!account) process.exit(1);
  console.log(`\n→ Usando a conta "${account.name}" (${account.id})`);
  const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: account.id };

  // D1
  const findDb = () =>
    parseJson<{ uuid: string; name: string }[]>(wrangler(['d1', 'list', '--json'], env)).find(
      (d) => d.name === DB_NAME,
    );
  let db = findDb();
  if (!db) {
    console.log(`Criando o banco D1 "${DB_NAME}"…`);
    // "enam" (leste da América do Norte) é a região disponível mais próxima do Brasil.
    wrangler(['d1', 'create', DB_NAME, '--location', 'enam'], env);
    db = findDb();
  }
  if (!db) throw new Error('Não foi possível localizar o D1 depois de criar.');
  console.log(`✔ D1 ${DB_NAME}: ${db.uuid}`);

  // KV das fotos
  const findKv = () =>
    parseJson<{ id: string; title: string }[]>(wrangler(['kv', 'namespace', 'list'], env)).find(
      (n) => n.title === `${DB_NAME}-${KV_BINDING}` || n.title === KV_BINDING,
    );
  let kv = findKv();
  if (!kv) {
    console.log(`Criando o namespace KV "${KV_BINDING}"…`);
    wrangler(['kv', 'namespace', 'create', KV_BINDING], env);
    kv = findKv();
  }
  if (!kv) throw new Error('Não foi possível localizar o KV depois de criar.');
  console.log(`✔ KV ${kv.title}: ${kv.id}`);

  // wrangler.jsonc (edição de texto para preservar os comentários)
  let text = readFileSync(CONFIG, 'utf8');
  text = /"account_id"\s*:/.test(text)
    ? text.replace(/"account_id"\s*:\s*"[^"]*"/, `"account_id": "${account.id}"`)
    : text.replace(
        /("name"\s*:\s*"[^"]*",)/,
        `$1\n  // Conta Cloudflare dedicada ao site (npm run cf:setup). Deploys só vão para esta conta.\n  "account_id": "${account.id}",`,
      );
  text = text.replace(/"database_id"\s*:\s*"[^"]*"/, `"database_id": "${db.uuid}"`);
  text = text.replace(
    /("binding"\s*:\s*"MEDIA_KV"\s*,\s*"id"\s*:\s*)"[^"]*"/,
    (_m, prefix: string) => `${prefix}"${kv.id}"`,
  );
  writeFileSync(CONFIG, text);
  console.log(`✔ ${CONFIG} atualizado (account_id, D1 e KV).`);

  console.log(`
Próximos passos:
  1. Cloudflare → Turnstile (nesta conta) → widget "M&M Veículos"; hostnames: localhost e mm-veiculos.<conta>.workers.dev.
     Copie a Site Key para ${CONFIG} → vars.TURNSTILE_SITE_KEY.
  2. npm run cf:deploy
  3. TURNSTILE_SECRET_KEY=<secret> npm run cf:secrets -- MeM_admin78812
  4. Faça commit do ${CONFIG} (os IDs não são segredos).`);
}

main();
