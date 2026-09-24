/**
 * Liga o domínio definitivo ao site (depois que o domínio estiver ATIVO nesta conta Cloudflare):
 *
 *   npm run cf:domain -- mmveiculos.com.br            -> endereço oficial https://www.mmveiculos.com.br
 *   npm run cf:domain -- mmveiculos.com.br --sem-www  -> endereço oficial https://mmveiculos.com.br
 *   npm run cf:domain -- mmveiculos.com.br --simular  -> só mostra o wrangler.jsonc resultante
 *
 * O que faz:
 *   0. confere no DNS público que o domínio já usa os nameservers da Cloudflare (senão, não mexe em nada);
 *   1. wrangler.jsonc: Custom Domains (com e sem www), PUBLIC_SITE_URL e ALLOW_INDEXING=true;
 *   2. Turnstile: adiciona os dois hostnames ao widget (mantém os atuais);
 *   3. npm run cf:deploy. Se falhar: restaura o wrangler.jsonc, REPUBLICA a versão anterior e devolve o Turnstile.
 * O site redireciona (301) os demais endereços para o oficial — ver src/server/canonical.ts.
 */
import { spawnSync } from 'node:child_process';
import { resolveNs } from 'node:dns/promises';
import { readFileSync, writeFileSync } from 'node:fs';

const CONFIG = 'wrangler.jsonc';
const shell = process.platform === 'win32';

function fail(message: string): never {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

function wrangler(args: string[]): { ok: boolean; stdout: string } {
  const quoted = args.map((a) => (shell && /[\s"&]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a));
  const result = spawnSync('npx', ['wrangler', ...quoted], { shell, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return { ok: result.status === 0, stdout: result.stdout ?? '' };
}

function deploy(): boolean {
  return spawnSync('npm', ['run', 'cf:deploy'], { stdio: 'inherit', shell }).status === 0;
}

function turnstileDomains(sitekey: string): string[] | null {
  const current = wrangler(['turnstile', 'widget', 'get', sitekey, '--json']);
  try {
    const parsed = JSON.parse(current.stdout.slice(current.stdout.indexOf('{'))) as {
      domains?: string[];
      result?: { domains?: string[] };
    };
    return parsed.result?.domains ?? parsed.domains ?? null;
  } catch {
    return null;
  }
}

function setTurnstileDomains(sitekey: string, domains: string[]): boolean {
  return wrangler(['turnstile', 'widget', 'update', sitekey, ...domains.flatMap((d) => ['--domain', d])]).ok;
}

const args = process.argv.slice(2);
const apex = (args.find((a) => !a.startsWith('--')) ?? '')
  .trim()
  .toLowerCase()
  .replace(/^https?:\/\//, '')
  .replace(/\/.*$/, '')
  .replace(/^www\./, '');
if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(apex)) {
  fail('Informe o domínio, ex.: npm run cf:domain -- mmveiculos.com.br');
}
const www = `www.${apex}`;
const canonicalHost = args.includes('--sem-www') ? apex : www;
const siteUrl = `https://${canonicalHost}`;
const simulate = args.includes('--simular');

// 0. O domínio precisa estar na Cloudflare (nameservers trocados no Registro.br) — senão nada é alterado.
if (!simulate) {
  const nameservers = await resolveNs(apex).catch(() => [] as string[]);
  if (!nameservers.length || !nameservers.every((ns) => ns.toLowerCase().endsWith('.ns.cloudflare.com'))) {
    fail(
      `O domínio ${apex} ainda não aponta para a Cloudflare (nameservers: ${nameservers.join(', ') || 'nenhum'}).\n` +
        '  Adicione o domínio na conta (Cloudflare → Add a domain), troque os nameservers no Registro.br e espere\n' +
        '  a Cloudflare marcar o domínio como "Active". Nada foi alterado.',
    );
  }
}

// 1. wrangler.jsonc (edição de texto para preservar os comentários)
const original = readFileSync(CONFIG, 'utf8');
let config = original;
const routes = `"routes": [\n    { "pattern": "${www}", "custom_domain": true },\n    { "pattern": "${apex}", "custom_domain": true },\n  ],`;
config = /^\s*"routes":/m.test(config)
  ? config.replace(/^(\s*)"routes": \[[\s\S]*?\],/m, `$1${routes}`)
  : config.replace(/^(\s*)("preview_urls": [a-z]+,)/m, `$1$2\n$1${routes}`);
config = config.replace(/"ALLOW_INDEXING": "[a-z]*"/, '"ALLOW_INDEXING": "true"');
config = /"PUBLIC_SITE_URL":/.test(config)
  ? config.replace(/"PUBLIC_SITE_URL": "[^"]*"/, `"PUBLIC_SITE_URL": "${siteUrl}"`)
  : config.replace(/^(\s*)"STORAGE_DRIVER":/m, `$1"PUBLIC_SITE_URL": "${siteUrl}",\n$1"STORAGE_DRIVER":`);
if (!config.includes(`"pattern": "${apex}"`) || !config.includes(`"PUBLIC_SITE_URL": "${siteUrl}"`)) {
  fail('Não consegui atualizar o wrangler.jsonc automaticamente. Siga o passo 6 do docs/DEPLOY.md.');
}
if (simulate) {
  console.log(config);
  console.log('\n(simulação: nada foi gravado nem publicado)');
  process.exit(0);
}
writeFileSync(CONFIG, config);
console.log(`✔ wrangler.jsonc: ${www} e ${apex} (oficial: ${siteUrl}), indexação liberada`);

// 2. Turnstile: mantém os hostnames atuais e acrescenta o domínio
const sitekey = /"TURNSTILE_SITE_KEY": "([^"]+)"/.exec(config)?.[1];
const previousDomains = sitekey ? turnstileDomains(sitekey) : null;
if (sitekey) {
  const all = [...new Set([...(previousDomains ?? []), apex, www])];
  console.log(
    setTurnstileDomains(sitekey, all)
      ? `✔ Turnstile: ${all.join(', ')}`
      : '⚠ Não consegui atualizar o Turnstile — adicione o domínio no painel (Turnstile → widget → Hostnames).',
  );
}

// 3. Publica — em caso de falha, volta TUDO ao estado anterior (arquivo, versão publicada e Turnstile)
console.log('\nPublicando…');
if (!deploy()) {
  writeFileSync(CONFIG, original);
  console.error('\n✖ O deploy falhou. Restaurando a configuração anterior e republicando…');
  const restored = deploy();
  if (sitekey && previousDomains?.length) setTurnstileDomains(sitekey, previousDomains);
  fail(
    restored
      ? `Nada mudou no site. Confira se o domínio ${apex} está "Active" nesta conta Cloudflare e rode de novo.`
      : 'ATENÇÃO: a republicação da versão anterior também falhou — rode "npm run cf:deploy" agora.',
  );
}

console.log(`\n✔ Pronto: ${siteUrl}`);
console.log('Próximos passos:');
console.log(`  - Abrir ${siteUrl}/robots.txt (deve liberar o site e apontar o sitemap)`);
console.log(`  - Google Search Console: adicionar ${apex} e enviar ${siteUrl}/sitemap.xml`);
console.log('  - Fazer commit do wrangler.jsonc atualizado');
