# Publicação no Cloudflare (produção recomendada)

O site roda inteiro no **plano gratuito da Cloudflare**, que — diferente do Hobby da Vercel — **permite uso comercial**.
Custo obrigatório: só o domínio, quando for comprado.

| Peça | Serviço Cloudflare | Configuração |
| --- | --- | --- |
| Site + painel + APIs | **Workers** (`@astrojs/cloudflare`) | `wrangler.jsonc` |
| Banco de dados | **D1** (SQLite) — binding `DB` | mesmas migrations de `migrations/` |
| Fotos | **Workers KV** — binding `MEDIA_KV` (grátis, sem cartão) · ou **R2** (binding `MEDIA`) | `STORAGE_DRIVER` |
| Anti-spam | **Turnstile** | `TURNSTILE_SITE_KEY` (var) + `TURNSTILE_SECRET_KEY` (segredo) |
| Senha do painel | segredos do Worker | `npm run cf:secrets` |
| Login por e-mail (opcional) | **Zero Trust Access** | `AUTH_MODE=cloudflare-access` |

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Recursos (D1 e KV)](#2-recursos-d1-e-kv)
3. [Primeiro deploy](#3-primeiro-deploy)
4. [Senha do painel e segredos](#4-senha-do-painel-e-segredos)
5. [Turnstile](#5-turnstile)
6. [Deploy automático a cada push](#6-deploy-automático-a-cada-push)
7. [Domínio próprio](#7-domínio-próprio)
8. [Opcional: R2 no lugar do KV](#8-opcional-r2-no-lugar-do-kv)
9. [Opcional: Cloudflare Access](#9-opcional-cloudflare-access)
10. [Limites do plano gratuito](#10-limites-do-plano-gratuito)
11. [Backup](#11-backup)
12. [Desenvolvimento local no runtime do Workers](#12-desenvolvimento-local-no-runtime-do-workers)
13. [Checklist](#13-checklist)

---

## 1. Pré-requisitos

- Conta gratuita na Cloudflare (de preferência com o e-mail da empresa).
- Node.js 22.12+ e o projeto instalado (`npm ci`).
- Login do Wrangler no computador: `npx wrangler login` (abre o navegador).
  Em servidores/CI use um token: variáveis `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (passo 6).

## 2. Recursos (D1 e KV)

**Use uma conta Cloudflare dedicada à M&M** (criada com o e-mail da empresa, sem outros sites). Assim os limites
gratuitos, os acessos e a cobrança — se um dia houver — ficam separados de qualquer outro projeto, e a conta pode ser
entregue ao cliente.

```bash
npx wrangler logout                         # sai de qualquer conta que estiver logada
npx wrangler login                          # entre com a conta DEDICADA
npm run cf:setup                            # mostra o e-mail logado e as contas acessíveis
npm run cf:setup -- --account=<ID>          # (se houver mais de uma) escolhe a conta
```

O `cf:setup` cria na conta escolhida o banco D1 `mm-veiculos` e o namespace KV das fotos (se ainda não existirem) e
grava no `wrangler.jsonc` o `account_id` — **a partir daí deploys, migrations e segredos só vão para essa conta** — e os
IDs do D1/KV. Faça commit do `wrangler.jsonc` (IDs não são segredos).

> Os IDs que estavam no `wrangler.jsonc` antes do `cf:setup` foram criados pela conta que estava logada no Wrangler do
> computador de desenvolvimento. Confira qual é com `npx wrangler whoami`. Se não for a conta dedicada, rode o
> `cf:setup` com a conta certa — os recursos antigos podem ser apagados depois no painel daquela conta.

## 3. Primeiro deploy

```bash
npm run cf:deploy
```

O comando aplica as migrations no D1 remoto, faz o build para Workers e publica. No final o Wrangler mostra a URL,
algo como `https://mm-veiculos.<sua-conta>.workers.dev`. O site abre com “Novos veículos em breve” até o primeiro
cadastro (nada é inventado).

> Deploys seguintes: o mesmo comando. As migrations novas são aplicadas automaticamente; os segredos são mantidos.

## 4. Senha do painel e segredos

Os segredos ficam guardados **no próprio Worker** (criptografados; nunca no Git). Grave uma vez:

```bash
npm run cf:secrets -- MeM_admin78812
```

- Gera `ADMIN_PASSWORD_HASH` (PBKDF2), `SESSION_SECRET` e `IP_HASH_SALT` e envia tudo com `wrangler secret bulk`
  (pela entrada padrão — nada é gravado em disco).
- Se no seu `.env` (ou no terminal) existirem `TURNSTILE_SECRET_KEY` e/ou `RESEND_API_KEY`, eles vão junto:
  `TURNSTILE_SECRET_KEY=0x... npm run cf:secrets -- MeM_admin78812`.
- Rodar de novo troca a senha e encerra todas as sessões abertas do painel.
- `MeM_admin78812` é a senha de **desenvolvimento/validação**. Antes de divulgar o site, troque por uma senha forte
  e exclusiva: `npm run cf:secrets` (o comando pergunta a senha sem mostrá-la no histórico).

Depois acesse `https://<sua-url>/admin`.

## 5. Turnstile

1. Cloudflare → **Turnstile** → widget `M&M Veículos` (modo **Managed**).
2. **Hostnames**: `localhost`, o host do Worker (`mm-veiculos.<sua-conta>.workers.dev`) e, depois, o domínio.
3. A **Site Key** é pública e fica em `wrangler.jsonc` → `vars.TURNSTILE_SITE_KEY`.
4. A **Secret Key** é segredo: `TURNSTILE_SECRET_KEY=0x... npm run cf:secrets -- <senha>` (ou
   `npx wrangler secret put TURNSTILE_SECRET_KEY`).

Sem a Secret Key, em produção o formulário “Anuncie seu veículo” fica “temporariamente indisponível” (falha segura).

## 6. Deploy automático a cada push

**Opção A — GitHub Actions (já incluído):** `.github/workflows/deploy-cloudflare.yml` roda lint, tipos e testes e
publica a cada push na `main`.

1. Cloudflare → **My Profile → API Tokens → Create Token** → modelo **Edit Cloudflare Workers** e acrescente a
   permissão **Account → D1 → Edit**. Restrinja à conta da M&M.
2. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = o token acima
   - `CLOUDFLARE_ACCOUNT_ID` = ID da conta (Cloudflare → Workers & Pages → coluna da direita)
3. Faça push na `main` (ou rode o workflow manualmente em **Actions → Deploy Cloudflare → Run workflow**).

Sem esses secrets o workflow apenas avisa e não publica. O workflow **CI** (`ci.yml`) verifica cada branch/PR.

**Opção B — Workers Builds (pelo painel, sem GitHub Actions):** Workers & Pages → `mm-veiculos` → **Settings →
Builds → Connect** ao repositório, com:

- Build command: `npm run cf:build`
- Deploy command: `npx wrangler d1 migrations apply mm-veiculos --remote && npx wrangler deploy`

Use só uma das opções para não publicar duas vezes.

## 7. Domínio próprio

1. Compre o domínio (ex.: **Registro.br**) e, no registrador, aponte os **nameservers** para a Cloudflare (Add a
   domain → plano Free).
2. Workers & Pages → `mm-veiculos` → **Settings → Domains & Routes → Add → Custom domain** →
   `www.seudominio.com.br` (e `seudominio.com.br`, se quiser). O HTTPS é automático.
3. Em `wrangler.jsonc` → `vars`: `"PUBLIC_SITE_URL": "https://www.seudominio.com.br"` e `"ALLOW_INDEXING": "true"`.
   Publique de novo (`npm run cf:deploy` ou push na `main`).
4. Adicione o domínio aos **Hostnames do Turnstile**.
5. Confira `https://www.seudominio.com.br/robots.txt` e envie o `sitemap.xml` ao **Google Search Console**.

Enquanto `ALLOW_INDEXING` for `false`, todas as páginas enviam `noindex` e o `robots.txt` bloqueia buscadores — a URL
`workers.dev` de validação não aparece no Google.

## 8. Opcional: R2 no lugar do KV

O KV gratuito aceita **1.000 gravações por dia** (cada foto = 2 a 3 gravações) e 1 GB — suficiente para o volume de uma
loja. Se crescer, o R2 oferece 10 GB e 1 milhão de gravações/mês grátis (exige cartão cadastrado na Cloudflare, sem
cobrança dentro do limite):

```bash
npx wrangler r2 bucket create mm-veiculos-media
```

1. Em `wrangler.jsonc`, descomente `r2_buckets` e troque `vars.STORAGE_DRIVER` para `"r2"`.
2. Copie as fotos existentes: `npm run cf:backup` (ainda com o KV) → publique com R2 →
   `npm run cf:restore -- backups/<pasta> --media-only` (o script grava no storage configurado).

## 9. Opcional: Cloudflare Access

Troca a senha única por login com e-mail (código enviado por e-mail), grátis até 50 usuários.

1. **Zero Trust → Access → Applications → Add → Self-hosted**, domínio do site, caminhos `/admin` e `/api/admin`.
2. Política **Allow** com os e-mails da equipe.
3. `wrangler.jsonc` → `vars`: `"AUTH_MODE": "cloudflare-access"`, `"CF_ACCESS_TEAM_DOMAIN":
   "https://<equipe>.cloudflareaccess.com"`, `"CF_ACCESS_AUD": "<Application Audience (AUD) Tag>"` e, opcionalmente,
   `"ADMIN_EMAILS": "a@x.com,b@y.com"`.

O servidor **também** valida o JWT do Access em toda requisição do painel — não basta esconder o link.

## 10. Limites do plano gratuito

Consultados na documentação oficial em 24/09/2026 (podem mudar — revise periodicamente).

| Serviço | Grátis | Uso estimado da M&M |
| --- | --- | --- |
| Workers | 100 mil requisições/dia, 10 ms de CPU por requisição; arquivos estáticos ilimitados | Página ≈ 1 requisição + 1 por foto exibida; fotos têm cache de 1 ano no navegador |
| D1 | 5 GB, 5 milhões de linhas lidas/dia, 100 mil gravações/dia | Dezenas de veículos: bem abaixo |
| KV | 1 GB, 100 mil leituras/dia, 1.000 gravações/dia | ~15 fotos por veículo × 2–3 gravações |
| R2 (opcional) | 10 GB, 1 mi gravações e 10 mi leituras/mês, saída grátis | — |
| Turnstile | ilimitado (até 20 widgets) | 1 widget |
| Access (opcional) | até 50 usuários | 1–3 pessoas |

Fontes: [Workers](https://developers.cloudflare.com/workers/platform/pricing/) ·
[D1](https://developers.cloudflare.com/d1/platform/pricing/) ·
[KV](https://developers.cloudflare.com/kv/platform/pricing/) ·
[R2](https://developers.cloudflare.com/r2/pricing/) ·
[Turnstile](https://developers.cloudflare.com/turnstile/plans/) ·
[Zero Trust](https://www.cloudflare.com/plans/zero-trust-services/)

## 11. Backup

```bash
npm run cf:backup                                  # D1 em SQL + todas as fotos → backups/cf-<data>/
npm run cf:restore -- backups/cf-<data>            # restaura banco + fotos (num D1 vazio)
npm run cf:restore -- backups/cf-<data> --media-only   # só as fotos
```

O D1 ainda guarda automaticamente o histórico recente (**Time Travel**: 7 dias no plano gratuito):
`npx wrangler d1 time-travel restore mm-veiculos --timestamp=<ISO>`.

## 12. Desenvolvimento local no runtime do Workers

`npm run dev` usa Node + SQLite local (mais rápido). Para testar no mesmo runtime da produção (workerd, D1/KV
simulados):

```bash
npm run cf:migrate:local
npx tsx scripts/hash-password.ts MeM_admin78812 --cloudflare   # copie as 3 primeiras linhas (sem "\") para .dev.vars
npm run cf:build
npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state
```

Ou, com recarga automática: `npm run cf:dev` (Astro dentro do workerd).

O arquivo `.dev.vars` guarda segredos locais e está no `.gitignore`.

## 13. Checklist

- [ ] Conta Cloudflare dedicada; `npm run cf:setup` executado e `wrangler.jsonc` com o `account_id` dela
- [ ] `npm run cf:deploy` sem erros (migrations aplicadas)
- [ ] `npm run cf:secrets` executado; `/admin` pede senha e aceita a senha definida
- [ ] Senha de desenvolvimento trocada por uma senha forte antes da divulgação
- [ ] Turnstile: hostnames certos e `TURNSTILE_SECRET_KEY` gravado; proposta de teste chegou no painel
- [ ] Configurações conferidas no painel (WhatsApp, Instagram, Facebook, e-mail, endereço/horário se quiser exibir)
- [ ] Veículos reais cadastrados com fotos; destaques marcados
- [ ] Deploy automático configurado (GitHub Actions **ou** Workers Builds)
- [ ] Domínio com HTTPS, `PUBLIC_SITE_URL` e `ALLOW_INDEXING=true`; sitemap no Search Console
- [ ] Primeiro backup feito (`npm run cf:backup`)
