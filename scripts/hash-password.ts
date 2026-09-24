/**
 * Gera o hash da senha do painel (ADMIN_PASSWORD_HASH) e segredos aleatórios.
 *
 *   npm run admin:hash-password                    -> Node/Vercel (600 mil iterações)
 *   npm run admin:hash-password -- --cloudflare    -> Cloudflare Workers (50 mil iterações)
 *
 * A senha é digitada no terminal (não fica no histórico) — ou passada como argumento.
 */
import { createInterface } from 'node:readline';
import { DEFAULT_ITERATIONS, hashPassword, toBase64Url, WORKERS_ITERATIONS } from '../src/lib/auth/password';

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
  const args = process.argv.slice(2);
  const cloudflare = args.includes('--cloudflare');
  let password = args.find((a) => !a.startsWith('--'));
  if (!password) password = await ask('Digite a nova senha do painel (mín. 12 caracteres): ');
  if (!password || password.length < 12) {
    console.error('✖ Use uma senha com pelo menos 12 caracteres.');
    process.exit(1);
  }
  const hash = await hashPassword(password, cloudflare ? WORKERS_ITERATIONS : DEFAULT_ITERATIONS);
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(48)));
  const salt = toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  if (cloudflare) {
    console.log('\nCloudflare: prefira `npm run cf:secrets` (grava tudo de uma vez). Ou grave cada valor com');
    console.log('`npx wrangler secret put <NOME>` / painel do Worker:\n');
  } else {
    console.log('\nVercel (Settings → Environment Variables) — cole os valores exatamente assim:\n');
  }
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`SESSION_SECRET=${secret}`);
  console.log(`IP_HASH_SALT=${salt}`);
  // O Vite expande "$NOME" em arquivos .env: no .env local cada "$" do hash precisa de barra invertida.
  console.log('\nArquivo .env local (os "$" do hash precisam de barra invertida):\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash.replaceAll('$', '\\$')}`);
  console.log(`SESSION_SECRET=${secret}`);
  console.log(`IP_HASH_SALT=${salt}`);
  console.log('\nGuarde a senha em local seguro. O hash não permite recuperar a senha.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
