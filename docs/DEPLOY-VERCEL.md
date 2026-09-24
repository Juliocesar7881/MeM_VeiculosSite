# Alternativa: publicação na Vercel (Vercel + Turso + Blob + Turnstile)

> **A hospedagem principal é a Cloudflare** — veja [DEPLOY.md](DEPLOY.md). Este guia continua válido caso um dia se
> prefira a Vercel: o mesmo código compila com `DEPLOY_TARGET=vercel` (script `vercel-build`).

Guia passo a passo para colocar o site no ar pela Vercel. **O domínio só é necessário no final** — tudo funciona antes
com a URL gratuita `*.vercel.app`.

> ⚠️ O plano **Hobby** da Vercel é para uso **pessoal/não comercial**. Para a produção comercial seria preciso o
> **Vercel Pro** (US$ 20/mês por membro) — um dos motivos para a Cloudflare ser a hospedagem principal.

## Sumário

1. [Contas necessárias](#1-contas-necessárias)
2. [Código no GitHub](#2-código-no-github)
3. [Banco (Turso)](#3-banco-turso)
4. [Projeto na Vercel](#4-projeto-na-vercel)
5. [Fotos (Vercel Blob privado)](#5-fotos-vercel-blob-privado)
6. [Senha do painel](#6-senha-do-painel)
7. [Turnstile](#7-turnstile)
8. [Variáveis de ambiente](#8-variáveis-de-ambiente)
9. [Primeiro deploy e migrations](#9-primeiro-deploy-e-migrations)
10. [Região das funções](#10-região-das-funções)
11. [Validação com o cliente](#11-validação-com-o-cliente)
12. [Domínio (somente no final)](#12-domínio-somente-no-final)
13. [Opcional: aviso de novas propostas por e-mail](#13-opcional-aviso-de-novas-propostas-por-e-mail)
14. [Opcional: Cloudflare R2 no lugar do Blob](#14-opcional-cloudflare-r2-no-lugar-do-blob)
15. [Checklist final](#15-checklist-final)

---

## 1. Contas necessárias

Crie (gratuitas) — de preferência com o e-mail da empresa:

- **GitHub** — guarda o código.
- **Vercel** — hospedagem (entre com a conta do GitHub).
- **Turso** — banco de dados (pode ser criado pela própria Vercel, veja o passo 3).
- **Cloudflare** — somente para o **Turnstile** agora (e DNS/migração no futuro).

## 2. Código no GitHub

```bash
git init            # se ainda não for um repositório
git add .
git commit -m "M&M Veículos: versão inicial"
git branch -M main
git remote add origin https://github.com/<usuario>/mm-veiculos.git
git push -u origin main
```

O `.gitignore` já impede o envio de `.env`, `.data/` (banco local e fotos) e `backups/`.

## 3. Banco (Turso)

**Opção A — pela Vercel (mais simples):** no projeto da Vercel → **Storage** → **Create Database** → **Turso** →
escolha uma região e conecte ao projeto. As variáveis de conexão são criadas automaticamente; confira os nomes e
garanta que existam **`DATABASE_URL`** (`libsql://...`) e **`DATABASE_AUTH_TOKEN`** (crie-as copiando os valores, se a
integração usar outros nomes, como `TURSO_DATABASE_URL`).

**Opção B — pela CLI do Turso:**

```bash
turso auth login
turso db create mm-veiculos --location <região mais próxima do Brasil disponível>
turso db show mm-veiculos --url          # -> DATABASE_URL
turso db tokens create mm-veiculos       # -> DATABASE_AUTH_TOKEN
```

**Recomendado:** crie um segundo banco (`mm-veiculos-preview`) para os deploys de _Preview_, assim testes nunca
alteram a produção.

## 4. Projeto na Vercel

1. **Add New → Project** → importe o repositório.
2. Framework: **Astro** (detectado). O build usa automaticamente o script `vercel-build`
   (`npm run db:migrate && astro build`), que aplica as migrations antes de compilar.
3. **Node.js**: 22.x ou superior (Settings → Build and Deployment).
4. Não clique em Deploy ainda — configure as variáveis (passo 8) antes. Se já tiver clicado, tudo bem: o build falha
   com uma mensagem clara pedindo o `DATABASE_URL`, e basta refazer após configurar.

## 5. Fotos (Vercel Blob privado)

1. Projeto → **Storage** → **Create Database** → **Blob** → **Access: Private** → conecte ao projeto.
2. A Vercel injeta a autenticação (OIDC / `BLOB_STORE_ID`) — não é preciso token dentro da Vercel.
3. Defina `STORAGE_DRIVER=vercel-blob`.
4. Para backups rodando no seu computador, copie o **Read/Write Token** do store para `BLOB_READ_WRITE_TOKEN` no
   `.env` local de backup (nunca no Git).

> O store precisa ser **privado**: as fotos de propostas contêm dados de clientes. As fotos de veículos são entregues
> pelo próprio site em `/media/...` com cache de CDN.

## 6. Senha do painel

No seu computador:

```bash
npm run admin:hash-password
```

Digite uma senha forte (12+ caracteres). O comando imprime `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` e `IP_HASH_SALT`
para colar na Vercel. Guarde a senha num gerenciador de senhas — o hash não permite recuperá-la. Para trocar a senha
depois, gere um novo hash e atualize a variável (todas as sessões abertas são encerradas).

## 7. Turnstile

1. Cloudflare → **Turnstile** → **Add widget**.
2. Nome: `M&M Veículos`; **Hostnames**: `localhost`, o domínio `*.vercel.app` do projeto e, no futuro, o domínio
   definitivo (`mmveiculos.com.br` e `www.mmveiculos.com.br`, por exemplo).
3. Modo: **Managed**.
4. Copie **Site Key** → `TURNSTILE_SITE_KEY` e **Secret Key** → `TURNSTILE_SECRET_KEY`.

Sem essas chaves, em produção o formulário “Anuncie seu veículo” mostra “temporariamente indisponível” (falha segura).

## 8. Variáveis de ambiente

Vercel → Settings → **Environment Variables**. Marque **Production** e **Preview** conforme a coluna.

| Variável               | Production            | Preview               | Valor                           |
| ---------------------- | --------------------- | --------------------- | ------------------------------- |
| `DATABASE_URL`         | ✅                    | ✅ (banco de preview) | `libsql://...`                  |
| `DATABASE_AUTH_TOKEN`  | ✅                    | ✅                    | token do Turso                  |
| `STORAGE_DRIVER`       | ✅                    | ✅                    | `vercel-blob`                   |
| `AUTH_MODE`            | ✅                    | ✅                    | `password`                      |
| `ADMIN_PASSWORD_HASH`  | ✅                    | ✅                    | do passo 6                      |
| `SESSION_SECRET`       | ✅                    | ✅                    | do passo 6                      |
| `IP_HASH_SALT`         | ✅                    | ✅                    | do passo 6                      |
| `TURNSTILE_SITE_KEY`   | ✅                    | ✅                    | do passo 7                      |
| `TURNSTILE_SECRET_KEY` | ✅                    | ✅                    | do passo 7                      |
| `ALLOW_INDEXING`       | `false` até o domínio | `false`               | depois `true` só em Production  |
| `PUBLIC_SITE_URL`      | só com domínio        | vazio                 | `https://www.seudominio.com.br` |

Nunca coloque segredos em arquivos do repositório.

## 9. Primeiro deploy e migrations

1. **Deploy**. O log deve mostrar `✔ migration aplicada: 0001_initial.sql` e `0002_seed_settings.sql`.
2. Acesse `https://<projeto>.vercel.app` — o site abre com “Novos veículos em breve” (estoque vazio, nada inventado).
3. Acesse `/admin`, entre com a senha, confira **Configurações** (dados oficiais já preenchidos) e cadastre o primeiro
   veículo com fotos.

As próximas migrations rodam sozinhas a cada deploy. Para rodar manualmente contra a produção:

```bash
DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npm run db:migrate
```

## 10. Região das funções

Cada página consulta o banco algumas vezes; por isso a função deve ficar **perto do banco**:
Vercel → Settings → **Functions → Region** → escolha a região mais próxima da região do Turso. As páginas já ficam em
cache na CDN global (60 s) e as fotos por 1 ano, então o visitante no Brasil recebe a maior parte do conteúdo da borda
mais próxima.

## 11. Validação com o cliente

- Compartilhe a URL `*.vercel.app` (ou a URL de um deploy de _Preview_).
- Com `ALLOW_INDEXING=false`, o `robots.txt` bloqueia buscadores e todas as páginas enviam `noindex` — o Google não
  indexa a versão temporária.
- Ajustes de textos/contatos são feitos no painel; ajustes de layout, pelo código (cada push gera um novo preview).

## 12. Domínio (somente no final)

1. Compre o domínio (ex.: **Registro.br** para `.com.br`).
2. Vercel → Settings → **Domains** → adicione `www.seudominio.com.br` e `seudominio.com.br` (redirecionando para o
   `www`, ou o contrário).
3. No painel do registrador, configure o DNS conforme a Vercel indicar (registro `A`/`CNAME`), **ou** aponte os
   nameservers para a **Cloudflare DNS** (grátis) e crie lá os registros indicados pela Vercel (proxy desligado — “DNS
   only”). O HTTPS é emitido automaticamente.
4. Atualize na Vercel (Production): `PUBLIC_SITE_URL=https://www.seudominio.com.br` e `ALLOW_INDEXING=true`.
5. Adicione o domínio nos **Hostnames do Turnstile**.
6. **Redeploy** (as variáveis entram no próximo deploy).
7. Confira: `https://www.seudominio.com.br/robots.txt` deve apontar o sitemap; teste o compartilhamento de um veículo
   no WhatsApp (foto + título + preço).
8. **Google Search Console** → adicione a propriedade → envie `https://www.seudominio.com.br/sitemap.xml`.
9. Atualize o link do site na bio do Instagram e na página do Facebook.

## 13. Opcional: aviso de novas propostas por e-mail

Crie uma conta no **Resend** (plano gratuito) com o e-mail que vai receber os avisos, gere uma API key e defina
`RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL` (ex.: `mmveiculos.sc@gmail.com`) e, após verificar o domínio no Resend,
`LEAD_NOTIFICATION_FROM` (ex.: `M&M Veículos <site@seudominio.com.br>`). O e-mail traz apenas o resumo e o link para a
proposta no painel. Sem essas variáveis, nada é enviado.

## 14. Opcional: Cloudflare R2 no lugar do Blob

Útil se o volume de fotos passar do plano gratuito do Blob (R2: 10 GB e 1 milhão de uploads/mês, sem custo de saída).

1. Cloudflare → **R2** → criar bucket `mm-veiculos` (**privado**, sem acesso público).
2. **Manage R2 API Tokens** → token com permissão _Object Read & Write_ restrito ao bucket.
3. Variáveis: `STORAGE_DRIVER=s3`, `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`,
   `S3_BUCKET=mm-veiculos`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
4. Para migrar fotos já existentes: `npm run db:backup -- --with-media` com as variáveis antigas e
   `npm run db:restore -- backups/<pasta> --with-media --yes` com as novas (veja [BACKUP.md](BACKUP.md)).

## 15. Checklist final

- [ ] Deploy de produção sem erros; migrations aplicadas
- [ ] `/admin` exige senha; senha forte guardada em local seguro
- [ ] Configurações conferidas (WhatsApp 554896410338, Instagram, Facebook, e-mail)
- [ ] Endereço e horário preenchidos (se o cliente quiser exibir)
- [ ] Veículos reais cadastrados com fotos; destaques marcados
- [ ] Formulário “Anuncie seu veículo” testado de ponta a ponta (proposta chegou no painel)
- [ ] Turnstile com chaves reais e hostname do domínio
- [ ] Domínio com HTTPS; `PUBLIC_SITE_URL` e `ALLOW_INDEXING=true` em Production
- [ ] Sitemap enviado ao Google Search Console
- [ ] Primeiro backup feito (`npm run db:backup -- --with-media`)
- [ ] Plano Vercel Pro contratado (uso comercial) — ou use a Cloudflare ([DEPLOY.md](DEPLOY.md))
