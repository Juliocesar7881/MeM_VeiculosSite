# Publicação na Cloudflare (Workers + D1 + KV/R2 + Turnstile)

Este é o caminho **principal** de hospedagem: plano gratuito da Cloudflare, uso comercial permitido, custo mensal
zero. O único custo obrigatório é o **domínio**. A alternativa pela Vercel continua documentada em
[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

## Situação atual (26/09/2026)

| Item             | Estado                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Site no ar       | **https://www.mmveiculos.com.br** (sem www, http:// e `mm-veiculos.lupinho7881.workers.dev` → 301 para ele)   |
| Painel           | https://www.mmveiculos.com.br/admin (senha forte definida em 24/09/2026; para trocar: passo 4)                |
| Conta Cloudflare | **lupinho7881@gmail.com** (dedicada a este projeto); zona `mmveiculos.com.br` no plano Free                   |
| Domínio          | Registro.br, na conta do cliente (titular), válido até 26/09/2031; nameservers `earl`/`lia.ns.cloudflare.com` |
| Worker           | `mm-veiculos` (Smart Placement, observabilidade ligada), Custom Domains com e sem www                         |
| Banco            | D1 `mm-veiculos` (região ENAM), migrations 0001–0005 aplicadas                                                |
| Fotos            | R2 `mm-veiculos-media` (privado; passo 7)                                                                     |
| Anti-spam        | Turnstile com chave real (hostnames: domínio com e sem www e a URL `*.workers.dev`)                           |
| Buscadores       | Liberados (`ALLOW_INDEXING=true`); falta enviar o sitemap ao Google Search Console                            |

Tudo o que o site precisa já está configurado em [`wrangler.jsonc`](../wrangler.jsonc) (bindings e variáveis
públicas) e nos **secrets** do Worker (valores sigilosos que não ficam no Git).

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Recursos da conta (já criados)](#2-recursos-da-conta-já-criados)
3. [Publicar uma nova versão](#3-publicar-uma-nova-versão)
4. [Senha do painel e secrets](#4-senha-do-painel-e-secrets)
5. [Turnstile](#5-turnstile)
6. [Domínio próprio](#6-domínio-próprio)
7. [Fotos no R2 (ativado em 26/09/2026)](#7-fotos-no-r2-ativado-em-26092026)
8. [Opcional: Cloudflare Access no painel](#8-opcional-cloudflare-access-no-painel)
9. [Opcional: aviso de propostas por e-mail](#9-opcional-aviso-de-propostas-por-e-mail)
10. [Limites do plano gratuito e monitoramento](#10-limites-do-plano-gratuito-e-monitoramento)
11. [Recriar tudo em outra conta](#11-recriar-tudo-em-outra-conta)
12. [Checklist de entrega](#12-checklist-de-entrega)

---

## 1. Pré-requisitos

- Node.js 22.12+ e `npm install` feito no projeto.
- Login no Wrangler (CLI da Cloudflare, já instalada no projeto):

```bash
npx wrangler login
npx wrangler whoami
```

## 2. Recursos da conta (já criados)

| Recurso   | Nome / binding                                                                    | Para quê                                                                                            |
| --------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Worker    | `mm-veiculos`                                                                     | O site e o painel (Astro SSR)                                                                       |
| D1        | 5 mi linhas lidas/dia, 100 mil escritas/dia, 500 MB por banco, Time Travel 7 dias | Com 150 veículos, Home ≈ 2.200 linhas e lista ≈ 1.700 por visita (medido; ver RELATORIO_ENTREGA §5) |
| KV        | 100 mil leituras/dia, **1 mil gravações/dia**, 1 GB                               | Só reserva das fotos antigas durante a migração para o R2 (passo 7)                                 |
| Turnstile | widget “M&M Veículos”                                                             | Anti-spam do formulário “Anuncie seu veículo”                                                       |

Variáveis **públicas** ficam em `wrangler.jsonc` → `vars` (`STORAGE_DRIVER`, `AUTH_MODE`, `ALLOW_INDEXING`,
`TURNSTILE_SITE_KEY` e, quando houver domínio, `PUBLIC_SITE_URL`).

Secrets já gravados no Worker: `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `IP_HASH_SALT`, `TURNSTILE_SECRET_KEY`.

## 3. Publicar uma nova versão

**Automático (padrão):** o Worker está ligado ao repositório do GitHub pelo Workers Builds da Cloudflare
(painel → Workers → mm-veiculos → Settings → Builds). Todo push na `main` gera o build e publica sozinho:

- Build command: `npm run cf:build`
- Deploy command: `npx wrangler deploy`

O andamento aparece no painel (mm-veiculos → Deployments) e como verificação no commit do GitHub.
Esse fluxo **não aplica migrations** do D1: quando houver migration nova em `migrations/`, rode antes
`npm run cf:migrate` (ou use o deploy manual abaixo).

**Manual (pelo computador):**

```bash
npm run verify        # lint + typecheck + testes + build (recomendado)
npm run cf:deploy     # aplica migrations novas no D1, gera o build e publica o Worker
```

O `cf:deploy` faz, na ordem: `wrangler d1 migrations apply DB --remote` (binding do `wrangler.jsonc`) → `astro build`
(`DEPLOY_TARGET=cloudflare`) → `wrangler deploy`. A troca de versão é instantânea e sem downtime.

- **Voltar para a versão anterior:** `npx wrangler rollback` (ou painel → Workers → mm-veiculos → Deployments).
  Atenção: o rollback não desfaz migrations do banco.
- **Testar localmente no runtime da Cloudflare:** `npm run cf:dev` (D1/KV simulados em `.wrangler/`).
- **Logs em tempo real:** `npx wrangler tail mm-veiculos`.

## 4. Senha do painel e secrets

A senha de desenvolvimento já foi substituída por uma senha forte (24/09/2026), passada fora do repositório. Para
trocar de novo (ex.: ao entregar o painel ou quando alguém sair da equipe):

```bash
npm run admin:hash-password -- --cloudflare
```

Digite a nova senha (12+ caracteres). O comando imprime `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` e `IP_HASH_SALT`.
Grave os dois primeiros no Worker (cada comando pede o valor — cole e tecle Enter):

```bash
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
```

- Sem terminal: painel da Cloudflare → **Workers & Pages → mm-veiculos → Settings → Variables and Secrets** →
  `ADMIN_PASSWORD_HASH` → **Edit** → cole o hash (tipo **Secret**) → **Deploy**.
- Trocar o hash já encerra todas as sessões abertas: quem estava logado com a senha antiga precisa entrar de novo.
- O novo `SESSION_SECRET` encerra todas as sessões abertas (inclusive a de desenvolvimento).
- Não é preciso refazer o deploy: gravar um secret já publica uma nova versão.
- O hash usa PBKDF2-SHA256 com **50 mil iterações** no Workers (limite de CPU do runtime); combinado com o bloqueio
  de tentativas por IP, uma senha longa continua inviável de adivinhar. Use 14+ caracteres.
- Guarde a senha num gerenciador de senhas: o hash não permite recuperá-la.

## 5. Turnstile

Painel da Cloudflare → **Turnstile** → widget “M&M Veículos”:

- **Hostnames:** `mmveiculos.com.br`, `www.mmveiculos.com.br` e `mm-veiculos.lupinho7881.workers.dev` (o
  `npm run cf:domain` adiciona o domínio automaticamente).
- A **Site Key** fica em `wrangler.jsonc` (`TURNSTILE_SITE_KEY`, é pública); a **Secret Key** fica no secret
  `TURNSTILE_SECRET_KEY` (`npx wrangler secret put TURNSTILE_SECRET_KEY`).
- Sem as chaves, o formulário mostra “temporariamente indisponível” (falha segura).

## 6. Domínio próprio

**Feito em 26/09/2026:** `mmveiculos.com.br` comprado pelo cliente no Registro.br (conta dele) e ligado ao site com
os passos abaixo. Observações do que aconteceu, para uma próxima vez:

- O Registro.br entrega o domínio com **DNSSEC ligado**. Ao trocar os servidores DNS ele tira o DNSSEC na hora e
  só publica os nameservers novos **~2 h depois** (tempo para a chave antiga sair dos caches). Não deixe DNSSEC
  preenchido ao trocar; se quiser DNSSEC de novo, ative pela Cloudflare (DNS → Settings) e cadastre o DS no Registro.br.
- A Cloudflare ativou a zona ~3 min depois de o Registro.br publicar os nameservers.
- O próprio Worker leva `http://` para `https://` (src/server/canonical.ts), sem depender de configuração no painel.

1. Compre o domínio no **Registro.br** (~R$ 40/ano para `.com.br`). O titular precisa de CPF ou CNPJ — de
   preferência o CNPJ da M&M.
2. Cloudflare (conta lupinho7881@gmail.com) → **Add a domain** → plano **Free** → a Cloudflare mostra 2 nameservers.
3. No Registro.br → domínio → **DNS** → “Alterar servidores DNS” → informe os 2 nameservers da Cloudflare. A
   ativação leva de minutos a algumas horas; a Cloudflare avisa por e-mail quando o domínio fica **Active**.
4. Com o domínio ativo, um comando faz o resto:

   ```bash
   npm run cf:domain -- mmveiculos.com.br             # endereço oficial: https://www.mmveiculos.com.br
   npm run cf:domain -- mmveiculos.com.br --sem-www   # ou, se preferir, sem www
   npm run cf:domain -- mmveiculos.com.br --simular   # só mostra o que mudaria
   ```

   O comando confere no DNS que o domínio já aponta para a Cloudflare (senão, não mexe em nada), adiciona os Custom
   Domains com e sem www (HTTPS automático), define `PUBLIC_SITE_URL` e `ALLOW_INDEXING=true`, libera o domínio no
   Turnstile e publica. Se a publicação falhar, ele restaura o `wrangler.jsonc`, republica a versão anterior e
   devolve o Turnstile ao que era. Depois de dar certo, faça commit do `wrangler.jsonc`.

   O próprio site redireciona (301) o endereço sem www e a URL `*.workers.dev` para o endereço oficial — não é
   preciso criar Redirect Rules.

5. Confira `https://www.seudominio.com.br/robots.txt` (deve liberar o site e apontar o sitemap) e compartilhe um
   veículo no WhatsApp para ver a prévia (foto + título + preço).
6. **Google Search Console** → adicionar propriedade (tipo _Domínio_, verificação por DNS na Cloudflare) → enviar
   `https://www.seudominio.com.br/sitemap.xml`.
7. Atualize o link do site no Instagram e no Facebook.

Com domínio próprio, o **cache de borda** passa a funcionar: páginas públicas ficam 60 s no data center mais próximo
do visitante (sem consultar o banco). Na URL `*.workers.dev` a Cloudflare ignora esse cache.

## 7. Fotos no R2 (ativado em 26/09/2026)

As fotos ficam no **R2** (bucket privado `mm-veiculos-media`, binding `MEDIA`): 10 GB grátis, 1 milhão de gravações
e 10 milhões de leituras por mês, saída grátis. O painel tem um **teto de 9 GB** (`STORAGE_CAP_BYTES` em
`src/config/site.ts`): acima disso recusa fotos novas com mensagem clara, então o uso nunca passa do gratuito e o
cartão cadastrado na Cloudflare nunca é cobrado. O Dashboard mostra o espaço usado.

Como foi feita a migração do KV (sem nenhuma foto quebrar):

1. R2 ativado no painel da Cloudflare (pede cartão; sem cobrança dentro do grátis).
2. Bucket privado criado: `npx wrangler r2 bucket create mm-veiculos-media --location enam`.
3. `wrangler.jsonc`: `STORAGE_DRIVER=r2` + `r2_buckets`, **mantendo** `kv_namespaces`: com os dois, o site grava no R2
   e lê do KV o que ainda não foi copiado (`src/lib/storage/fallback.ts`).
4. Cópia conferida byte a byte (e contra o tamanho gravado no KV), com o site no ar: `npm run cf:migrate-media`.
   Para só conferir: `npm run cf:migrate-media -- --check`.
5. Conferência final (668/668 idênticos) e `kv_namespaces` removido do `wrangler.jsonc` no mesmo dia: o site usa só o
   R2. O namespace KV `mm-veiculos-media` (cópia antiga das fotos) pode ser apagado no painel da Cloudflare.

O bucket **não** deve ser público: as fotos de propostas têm dados de clientes. O site entrega as fotos de veículos
por `/media/...` (cache de 1 ano) e as de propostas só para o painel.

## 8. Opcional: Cloudflare Access no painel

Para vários usuários, cada um com o próprio e-mail (grátis até 50 usuários):

1. **Zero Trust → Access → Applications → Add → Self-hosted**: domínio `www.seudominio.com.br`, caminhos `/admin` e
   `/api/admin`; política _Allow_ para os e-mails autorizados (login por código enviado ao e-mail).
2. Copie o **Application Audience (AUD) Tag**.
3. Em `wrangler.jsonc` → `vars`: `"AUTH_MODE": "cloudflare-access"`,
   `"CF_ACCESS_TEAM_DOMAIN": "https://<equipe>.cloudflareaccess.com"`, `"CF_ACCESS_AUD": "<AUD>"` e, opcionalmente,
   `"ADMIN_EMAILS": "a@x.com,b@y.com"`. Depois `npm run cf:deploy`.

O servidor valida o JWT do Access em toda requisição do painel (não basta esconder o link).

## 9. Opcional: aviso de propostas por e-mail

Conta gratuita no **Resend** → API key → `npx wrangler secret put RESEND_API_KEY`. Em `vars`:
`"LEAD_NOTIFICATION_EMAIL": "mmveiculos.sc@gmail.com"` e, depois de verificar o domínio no Resend,
`"LEAD_NOTIFICATION_FROM": "M&M Veículos <site@seudominio.com.br>"`. O e-mail traz só o resumo e o link para a
proposta no painel.

## 10. Limites do plano gratuito e monitoramento

Consultados na documentação oficial em 24/09/2026 (planos mudam; revise periodicamente). Os limites renovam
diariamente às 00:00 UTC (21:00 em Brasília).

| Serviço   | Limite gratuito                                                                     | O que significa para a M&M                                                                                          |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Workers   | 100 mil requisições/dia, 10 ms de CPU por requisição; arquivos estáticos ilimitados | HTML, fotos e contadores contam; estáticos (CSS/JS/logo) não. Visita completa ≈ 60 requisições → ~1.500 visitas/dia |
| D1        | 5 mi linhas lidas/dia, 100 mil escritas/dia, 500 MB por banco, Time Travel 7 dias   | Muito acima do necessário para um estoque de centenas de veículos                                                   |
| KV        | 100 mil leituras/dia, **1 mil gravações/dia**, 1 GB                                 | Fotos: ~250 fotos de veículo por dia (ver passo 7)                                                                  |
| R2        | 10 GB, 1 mi gravações e 10 mi leituras por mês, saída grátis                        | Fotos (desde 26/09/2026): ~900 veículos com 12 fotos até o teto de 9 GB do painel, sem cobrança                     |
| Turnstile | Gratuito                                                                            | —                                                                                                                   |
| Access    | Até 50 usuários                                                                     | —                                                                                                                   |

Se algum limite diário estourar, as requisições daquele tipo falham até a renovação. O painel mostra uma mensagem
clara quando a cota de fotos acaba; no formulário público a proposta é salva mesmo assim (sem as fotos) com uma
anotação para pedir as fotos pelo WhatsApp. Para crescer além disso: **Workers Paid** (US$ 5/mês por conta).

Monitoramento: painel da Cloudflare → Workers → `mm-veiculos` → **Metrics/Logs**; D1 → **Metrics**; KV → **Metrics**.

## 11. Recriar tudo em outra conta

Útil se o site for transferido para uma conta da própria M&M:

```bash
npx wrangler login
npx wrangler d1 create mm-veiculos --location enam     # copie o database_id para o wrangler.jsonc
npx wrangler kv namespace create MEDIA_KV              # copie o id para o wrangler.jsonc (ou use R2, passo 7)
npm run admin:hash-password -- --cloudflare            # e grave os secrets (passo 4)
npx wrangler secret put IP_HASH_SALT
npx wrangler secret put TURNSTILE_SECRET_KEY            # widget novo no Turnstile da conta nova
npm run cf:deploy                                       # cria as tabelas e publica
```

Para levar os dados: `npm run cf:backup` na conta antiga e `npm run cf:restore -- backups/cf-<data>` na nova (banco
recém-criado, vazio). Detalhes em [BACKUP.md](BACKUP.md).

## 12. Checklist de entrega

- [x] Senha de desenvolvimento substituída por senha forte (passo 4) — falta entregá-la ao cliente de forma segura
- [ ] Contatos conferidos no site (WhatsApp 554896410338, Instagram, Facebook, e-mail, slogan — em `src/config/site.ts`)
- [ ] Endereço e horário preenchidos, se o cliente quiser exibir
- [x] R2 ativado (passo 7) — fotos migradas do KV e conferidas em 26/09/2026
- [ ] Veículos reais cadastrados com fotos; destaques marcados
- [ ] Formulário “Anuncie seu veículo” testado de ponta a ponta (proposta chegou no painel)
- [x] Domínio comprado e ativo na Cloudflare; `npm run cf:domain -- mmveiculos.com.br` executado (26/09/2026)
- [ ] Sitemap enviado ao Google Search Console
- [x] Backup inicial feito (`npm run cf:backup`) — repetir depois do cadastro real e semanalmente
