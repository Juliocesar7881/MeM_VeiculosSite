# Publicação na Cloudflare (Workers + D1 + KV/R2 + Turnstile)

Este é o caminho **principal** de hospedagem: plano gratuito da Cloudflare, uso comercial permitido, custo mensal
zero. O único custo obrigatório é o **domínio**. A alternativa pela Vercel continua documentada em
[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

## Situação atual (24/09/2026)

| Item                        | Estado                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Site no ar (URL temporária) | **https://mm-veiculos.lupinho7881.workers.dev**                                                              |
| Painel                      | https://mm-veiculos.lupinho7881.workers.dev/admin (senha forte definida em 24/09/2026; para trocar: passo 4) |
| Conta Cloudflare            | **lupinho7881@gmail.com** (dedicada a este projeto)                                                          |
| Worker                      | `mm-veiculos` (Smart Placement, observabilidade ligada)                                                      |
| Banco                       | D1 `mm-veiculos` (região ENAM), migrations 0001–0005 aplicadas                                               |
| Fotos                       | Workers KV `MEDIA_KV` (o R2 ainda não está ativado na conta, ver passo 7)                                    |
| Anti-spam                   | Turnstile com chave real (hostname `mm-veiculos.lupinho7881.workers.dev`)                                    |
| Buscadores                  | Bloqueados (`ALLOW_INDEXING=false`) até existir o domínio                                                    |

Tudo o que o site precisa já está configurado em [`wrangler.jsonc`](../wrangler.jsonc) (bindings e variáveis
públicas) e nos **secrets** do Worker (valores sigilosos que não ficam no Git).

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Recursos da conta (já criados)](#2-recursos-da-conta-já-criados)
3. [Publicar uma nova versão](#3-publicar-uma-nova-versão)
4. [Senha do painel e secrets](#4-senha-do-painel-e-secrets)
5. [Turnstile](#5-turnstile)
6. [Domínio próprio](#6-domínio-próprio)
7. [Ativar o R2 para as fotos (recomendado)](#7-ativar-o-r2-para-as-fotos-recomendado)
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

| Recurso   | Nome / binding        | Para quê                                                     |
| --------- | --------------------- | ------------------------------------------------------------ |
| Worker    | `mm-veiculos`         | O site e o painel (Astro SSR)                                |
| D1        | `mm-veiculos` → `DB`  | Banco SQLite (veículos, propostas, configurações, histórico) |
| KV        | `MEDIA_KV`            | Fotos (enquanto o R2 não é ativado)                          |
| Turnstile | widget “M&M Veículos” | Anti-spam do formulário “Anuncie seu veículo”                |

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

- **Hostnames:** mantenha `mm-veiculos.lupinho7881.workers.dev` durante a validação e **adicione o domínio definitivo** (ex.:
  `mmveiculos.com.br` e `www.mmveiculos.com.br`) quando ele existir.
- A **Site Key** fica em `wrangler.jsonc` (`TURNSTILE_SITE_KEY`, é pública); a **Secret Key** fica no secret
  `TURNSTILE_SECRET_KEY` (`npx wrangler secret put TURNSTILE_SECRET_KEY`).
- Sem as chaves, o formulário mostra “temporariamente indisponível” (falha segura).

## 6. Domínio próprio

Em 24/09/2026, **`mmveiculos.com.br` estava disponível** no Registro.br (e também `mmveiculossc.com.br`;
`mmveiculos.net.br` já tem dono).

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

## 7. Ativar o R2 para as fotos (recomendado)

O KV gratuito aceita **1.000 gravações por dia**. Cada foto de veículo gera 4 arquivos (grande, média, miniatura e
compartilhamento), ou seja, **~250 fotos por dia**; cada foto de proposta gera 2. Para o cadastro inicial do estoque
(dezenas de veículos com 15–30 fotos), ative o R2: 10 GB grátis, 1 milhão de gravações e 10 milhões de leituras por
mês.

1. Painel da Cloudflare → **R2** → _Purchase R2 / Enable_ (o plano gratuito pode exigir um cartão cadastrado na conta;
   só há cobrança acima dos limites gratuitos).
2. Crie o bucket (privado):

   ```bash
   npx wrangler r2 bucket create mm-veiculos-media
   ```

3. Copie as fotos que já estão no KV (se houver):

   ```bash
   npm run cf:backup
   ```

4. Em `wrangler.jsonc`: descomente `"r2_buckets"` e troque `"STORAGE_DRIVER": "kv"` por `"r2"`.
5. Envie as fotos do backup para o R2 e publique:

   ```bash
   npm run cf:restore -- backups/cf-<data> --media-only
   npm run cf:deploy
   ```

6. Abra alguns veículos no site e confira as fotos. Depois de alguns dias, o namespace KV pode ser removido.

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
| Workers   | 100 mil requisições/dia, 10 ms de CPU por requisição; arquivos estáticos ilimitados | HTML e fotos contam; estáticos (CSS/JS/logo) não. Uma visita típica usa ~5–15 requisições → milhares de visitas/dia |
| D1        | 5 mi linhas lidas/dia, 100 mil escritas/dia, 500 MB por banco, Time Travel 7 dias   | Muito acima do necessário para um estoque de centenas de veículos                                                   |
| KV        | 100 mil leituras/dia, **1 mil gravações/dia**, 1 GB                                 | Fotos: ~250 fotos de veículo por dia (ver passo 7)                                                                  |
| R2        | 10 GB, 1 mi gravações e 10 mi leituras por mês, saída grátis                        | Folga para anos de fotos                                                                                            |
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
- [ ] R2 ativado antes do cadastro do estoque inicial (passo 7)
- [ ] Veículos reais cadastrados com fotos; destaques marcados
- [ ] Formulário “Anuncie seu veículo” testado de ponta a ponta (proposta chegou no painel)
- [ ] Domínio comprado e ativo na Cloudflare; `npm run cf:domain -- <domínio>` executado com sucesso
- [ ] Sitemap enviado ao Google Search Console
- [x] Backup inicial feito (`npm run cf:backup`) — repetir depois do cadastro real e semanalmente
