/**
 * Grava no Worker do Cloudflare os segredos do painel (uma única vez — deploys não apagam segredos).
 *
 *   npm run cf:secrets                    -> pergunta a senha no terminal
 *   npm run cf:secrets -- MeM_admin78812  -> usa a senha informada
 *   npm run cf:secrets -- --dry-run       -> só mostra quais segredos seriam gravados
 *
 * Gera ADMIN_PASSWORD_HASH (PBKDF2, 50 mil iterações — limite do Workers), SESSION_SECRET e IP_HASH_SALT.
 * Também envia, se estiverem definidas no ambiente/.env: TURNSTILE_SECRET_KEY e RESEND_API_KEY
 * (com LEAD_NOTIFICATION_EMAIL/LEAD_NOTIFICATION_FROM).
 *
 * Os valores vão para o `wrangler secret bulk` pela entrada padrão — nada é gravado em disco.
 * Trocar a senha (rodar de novo) encerra todas as sessões abertas do painel.
 */
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { hashPassword, toBase64Url, WORKERS_ITERATIONS } from '../src/lib/auth/password';
import { loadEnv } from './lib/env';

const OPTIONAL = ['TURNSTILE_SECRET_KEY', 'RESEND_API_KEY'];
/** Só fazem sentido junto com RESEND_API_KEY. */
const NOTIFICATION = ['LEAD_NOTIFICATION_EMAIL', 'LEAD_NOTIFICATION_FROM'];

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  let password = args.find((a) => !a.startsWith('--'));
  if (!password) password = await ask('Senha do painel (mín. 12 caracteres): ');
  if (!password || password.length < 12) {
    console.error('✖ Use uma senha com pelo menos 12 caracteres.');
    process.exit(1);
  }

  const secrets: Record<string, string> = {
    ADMIN_PASSWORD_HASH: await hashPassword(password, WORKERS_ITERATIONS),
    SESSION_SECRET: toBase64Url(crypto.getRandomValues(new Uint8Array(48))),
    IP_HASH_SALT: toBase64Url(crypto.getRandomValues(new Uint8Array(24))),
  };
  const extra = process.env.RESEND_API_KEY?.trim() ? [...OPTIONAL, ...NOTIFICATION] : OPTIONAL;
  for (const name of extra) {
    const value = process.env[name]?.trim();
    if (value) secrets[name] = value;
  }

  console.log(`Segredos: ${Object.keys(secrets).join(', ')}`);
  if (dryRun) {
    console.log('(--dry-run: nada foi enviado)');
    return;
  }

  const result = spawnSync('npx', ['wrangler', 'secret', 'bulk'], {
    input: JSON.stringify(secrets),
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error(
      '\n✖ Falha ao gravar os segredos. Confira o login (`npx wrangler login` ou CLOUDFLARE_API_TOKEN) e, se o ' +
        'Worker ainda não existir, rode `npm run cf:deploy` antes.',
    );
    process.exit(result.status ?? 1);
  }
  console.log('\n✔ Segredos gravados. O painel já aceita a nova senha (sessões antigas foram encerradas).');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
