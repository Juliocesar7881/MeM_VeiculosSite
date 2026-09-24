/**
 * Gera o hash da senha do painel (ADMIN_PASSWORD_HASH) e um SESSION_SECRET aleatório.
 *   npm run admin:hash-password
 * A senha é digitada no terminal (não fica no histórico) — ou passada como argumento.
 */
import { createInterface } from 'node:readline';
import { hashPassword, toBase64Url } from '../src/lib/auth/password';

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
  let password = process.argv[2];
  if (!password) password = await ask('Digite a nova senha do painel (mín. 12 caracteres): ');
  if (!password || password.length < 12) {
    console.error('✖ Use uma senha com pelo menos 12 caracteres.');
    process.exit(1);
  }
  const hash = await hashPassword(password);
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(48)));
  const salt = toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
  console.log('\nAdicione nas variáveis de ambiente (Vercel → Settings → Environment Variables):\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`SESSION_SECRET=${secret}`);
  console.log(`IP_HASH_SALT=${salt}`);
  console.log('\nGuarde a senha em local seguro. O hash não permite recuperar a senha.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
