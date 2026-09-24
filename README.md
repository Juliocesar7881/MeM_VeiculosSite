# M&M Veículos — site e painel administrativo

Site comercial e painel de gestão da **M&M Veículos** (Massaranduba - SC): estoque de carros, motos, scooters,
pesados e máquinas agrícolas, **ofertas**, **repasses**, **favoritos**, formulário **“Anuncie seu veículo”** com
fotos, e painel para gerenciar veículos, propostas e dados da empresa.

> “Construindo credibilidade a cada negociação.”

- **Publicação (produção, grátis): [docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)**
- Publicação alternativa na Vercel: [docs/DEPLOY.md](docs/DEPLOY.md)
- Manual do administrador (linguagem simples): [docs/MANUAL_ADMIN.md](docs/MANUAL_ADMIN.md)
- Arquitetura: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Backup e restauração: [docs/BACKUP.md](docs/BACKUP.md)
- Auditoria final (segurança, performance, SEO, acessibilidade…): [docs/AUDITORIA.md](docs/AUDITORIA.md)

---

## Sumário

1. [O que o sistema faz](#o-que-o-sistema-faz)
2. [Stack](#stack)
3. [Por que Cloudflare (e a Vercel como alternativa)](#por-que-cloudflare-e-a-vercel-como-alternativa)
4. [Arquitetura resumida](#arquitetura-resumida)
5. [Instalação e desenvolvimento local](#instalação-e-desenvolvimento-local)
6. [Scripts](#scripts)
7. [Variáveis de ambiente](#variáveis-de-ambiente)
8. [Banco de dados e migrations](#banco-de-dados-e-migrations)
9. [Fotos (armazenamento)](#fotos-armazenamento)
10. [Autenticação do painel](#autenticação-do-painel)
11. [Anti-spam (Turnstile + rate limit)](#anti-spam-turnstile--rate-limit)
12. [Testes](#testes)
13. [Preview, produção e domínio](#preview-produção-e-domínio)
14. [Custos e planos gratuitos](#custos-e-planos-gratuitos)
15. [Backup e restauração](#backup-e-restauração)
16. [Estrutura de pastas](#estrutura-de-pastas)
17. [Dados que ainda faltam](#dados-que-ainda-faltam)

---

## O que o sistema faz

**Site público**

| Rota | Conteúdo |
| --- | --- |
| `/` | Hero com busca, atalhos por categoria, destaques, ofertas, repasses (só aparece se houver), “Quer vender seu veículo?”, bloco da empresa |
| `/estoque` | Estoque com busca (marca/modelo/versão), filtros, ordenação e paginação — tudo na URL (`/estoque?marca=Toyota`, `?oferta=true`, `?repasse=true`) |
| `/veiculo/[slug]` | Galeria (swipe, setas, miniaturas, tela cheia), ficha técnica, opcionais, “Tenho interesse” no WhatsApp, vendido → “Procurando algo parecido?” |
| `/ofertas` | Veículos em oferta ativa, com “De R$ X por R$ Y” quando houver preço anterior |
| `/repasses` | Veículos com tipo comercial “repasse” + texto configurável |
| `/anuncie-seu-veiculo` | Formulário de proposta com até 6 fotos (comprimidas no navegador), Turnstile e consentimento LGPD |
| `/favoritos` | Favoritos salvos no navegador (sem login) |
| `/empresa`, `/contato`, `/politica-de-privacidade` | Institucional |
| `/sitemap.xml`, `/robots.txt` | Gerados dinamicamente |

**Painel (`/admin`)** — Dashboard, Veículos (lista com filtros e ações rápidas), Novo veículo, fotos (upload múltiplo,
arrastar, reordenar, capa, excluir), Propostas (status, WhatsApp do cliente, anotações, **transformar em veículo**,
exclusão LGPD), Ofertas e Repasses (filtros da lista), Configurações (contatos, redes, textos).

**Destaque, Oferta e Repasse são independentes**: `featured`, `is_offer` (+ período e preço anterior) e
`commercial_type = normal | repasse`. Um carro pode ser destaque + oferta, só repasse, os três, etc.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Front-end / SSR | **Astro 7** (Islands — JavaScript só onde há interação; ~24 KB de JS no site inteiro) |
| Linguagem | **TypeScript strict** (`astro/tsconfigs/strictest`) |
| CSS | **Tailwind CSS 4** + design system próprio (preto/grafite + dourado metálico da logo, seções claras) |
| Hospedagem (produção) | **Cloudflare Workers** via `@astrojs/cloudflare` — plano gratuito, uso comercial permitido |
| Hospedagem (alternativas) | **Vercel** (`@astrojs/vercel`) e servidor **Node** (`@astrojs/node`, usado no desenvolvimento) |
| Banco | **Cloudflare D1** em produção · **libSQL/SQLite** local em arquivo (ou **Turso** na Vercel) — mesmas migrations |
| Fotos | Drivers: **Workers KV** e **R2** (Cloudflare), **local**, **Vercel Blob (privado)**, **S3** |
| Admin/Auth | Senha única com hash PBKDF2 + sessão assinada · **Cloudflare Access** opcional (login por e-mail) |
| Anti-spam | **Cloudflare Turnstile** + rate limit no banco + honeypot + validação no servidor |
| Validação | **Zod 4** |
| Testes | **Vitest** (unitários + integração com banco real em memória) e **Playwright** (E2E) |

## Por que Cloudflare (e a Vercel como alternativa)

A produção roda no **Cloudflare** porque o plano gratuito cobre tudo o que o site precisa **e permite uso comercial**
(o Hobby da Vercel é só para uso pessoal/não comercial — [regras de uso justo](https://vercel.com/docs/limits/fair-use-guidelines)).

| Peça | Cloudflare (produção) | Vercel (alternativa) |
| --- | --- | --- |
| Hospedagem | Workers (`npm run cf:deploy`) | Vercel Functions (`vercel-build`) |
| Banco | D1 (binding `DB`) | Turso (libSQL) |
| Fotos | Workers KV (grátis, sem cartão) ou R2 | Vercel Blob privado ou R2 via S3 |
| Segredos | `npm run cf:secrets` (guardados no Worker) | Environment Variables do projeto |
| Admin | Senha + sessão, ou Cloudflare Access | Senha + sessão |
| Anti-spam | Turnstile | Turnstile |

O código é o mesmo: o `astro.config.mjs` escolhe o adapter por `DEPLOY_TARGET` e o módulo `@/server/platform`
troca banco/storage (D1/KV/R2 no Workers; libSQL/local/Blob/S3 no Node). Nenhum repositório ou página muda.

## Arquitetura resumida

```
Navegador ──► Cloudflare (borda) ── arquivos estáticos /_astro (cache imutável)
                 │
                 ▼
          Worker (Astro SSR)
          middleware.ts  → CSRF (origem), autenticação do /admin, headers de segurança, cache
                 │
          pages/ (Astro)  → só apresentação: chama serviços, nunca SQL
                 │
          services/       → regras de negócio (oferta ativa, publicação, conversão proposta→veículo…)
                 │
     repositories/  +  lib/storage/        → SQL parametrizado  |  fotos
                 │                 │
          D1 (SQLite)          Workers KV ou R2        (Node/Vercel: libSQL/Turso + local/Blob/S3)
```

Detalhes, modelo de dados e decisões: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Instalação e desenvolvimento local

Requisitos: **Node.js 22.12+** (testado com Node 24) e npm.

```bash
npm install
cp .env.example .env              # no Windows: copy .env.example .env
npm run db:migrate                # cria .data/dev.db
npm run db:seed:demo              # (opcional) veículos e propostas de DEMONSTRAÇÃO, só no banco local
npm run dev                       # http://localhost:4321  —  painel em http://localhost:4321/admin
```

- **Senha de desenvolvimento do painel: `MeM_admin78812`.** Vale automaticamente no `npm run dev` enquanto
  `ADMIN_PASSWORD_HASH` estiver vazio no `.env` (a tela de login avisa). Builds de produção **nunca** aceitam essa
  senha padrão — lá ela vem do segredo `ADMIN_PASSWORD_HASH` (`npm run cf:secrets`).
- Para usar outra senha localmente: `npm run admin:hash-password` e cole a linha “Arquivo .env local” (no `.env`
  cada `$` do hash precisa de `\`).

- Em desenvolvimento o Turnstile usa automaticamente as **chaves de teste oficiais** da Cloudflare.
- As fotos ficam em `.data/uploads` (driver `local`). Nada disso vai para o Git.
- O seed de demonstração **recusa** rodar em banco remoto e marca tudo como “FOTO DEMONSTRATIVA”.
- Para recomeçar do zero: `npm run db:reset`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build com o adapter Node |
| `npm run cf:setup` | Prepara a conta Cloudflare dedicada: cria D1/KV e trava o `account_id` no `wrangler.jsonc` |
| `npm run cf:build` | Build para o Cloudflare Workers (`dist/`) |
| `npm run cf:deploy` | **Publica no Cloudflare**: migrations do D1 remoto + build + `wrangler deploy` |
| `npm run cf:secrets -- <senha>` | Grava no Worker a senha do painel, `SESSION_SECRET`, `IP_HASH_SALT` (+ Turnstile/Resend se definidos) |
| `npm run cf:dev` | Desenvolvimento dentro do runtime do Workers (D1/KV locais) |
| `npm run cf:migrate` / `cf:migrate:local` | Migrations no D1 remoto / local |
| `npm run cf:backup` / `cf:restore` | Backup e restauração do D1 + fotos (KV/R2) |
| `npm run vercel-build` | Usado pela Vercel: aplica migrations e faz o build |
| `npm run preview:local` | Build de **produção** rodando localmente (adapter Node) em http://localhost:4330 — útil para Lighthouse |
| `npm run typecheck` | `astro check` (TypeScript + templates) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` / `format:check` | Prettier |
| `npm test` | Testes unitários + integração (Vitest) |
| `npm run test:e2e` | Testes E2E (Playwright, usa o Edge/Chrome instalado) |
| `npm run verify` | lint + typecheck + testes + build |
| `npm run db:migrate` | Aplica migrations pendentes no `DATABASE_URL` |
| `npm run db:seed:demo` | Dados de demonstração (somente banco local) |
| `npm run db:reset` | Recria o banco local |
| `npm run db:backup` / `db:restore` | Backup e restauração (veja [docs/BACKUP.md](docs/BACKUP.md)) |
| `npm run admin:hash-password` | Gera o hash da senha do painel |
| `npm run brand:logo` | Regenera logo SVG/PNG, favicons e imagem Open Graph |

## Variáveis de ambiente

Todas documentadas em [`.env.example`](.env.example). Nenhum segredo vai para o navegador nem para o Git.

**No Cloudflare:** variáveis públicas ficam em `wrangler.jsonc` → `vars` (`STORAGE_DRIVER`, `AUTH_MODE`,
`ALLOW_INDEXING`, `PUBLIC_SITE_URL`, `TURNSTILE_SITE_KEY`); segredos (`ADMIN_PASSWORD_HASH`, `SESSION_SECRET`,
`IP_HASH_SALT`, `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`) ficam no Worker via `npm run cf:secrets`. Banco e fotos são
bindings (`DB`, `MEDIA_KV`/`MEDIA`), sem variáveis de conexão.

| Variável | Obrigatória em produção | Descrição |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | ao ter domínio | URL canônica (ex.: `https://www.mmveiculos.com.br`). Vazia = usa a URL da requisição |
| `ALLOW_INDEXING` | — | `true` só no domínio definitivo. Enquanto `false`, `robots.txt` bloqueia buscadores |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | Node/Vercel | Turso (`libsql://…`). No Cloudflare o banco é o binding `DB` |
| `STORAGE_DRIVER` | sim | Cloudflare: `kv` ou `r2` · Vercel: `vercel-blob` ou `s3` · `local` só em desenvolvimento |
| `BLOB_READ_WRITE_TOKEN` | não na Vercel (OIDC) | Necessário só fora da Vercel (scripts de backup) |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | se `s3` | Cloudflare R2 ou outro S3 |
| `AUTH_MODE` | — | `password` (padrão) ou `cloudflare-access` |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | sim (`password`) | Gerados por `npm run admin:hash-password` |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAILS` | se `cloudflare-access` | Validação do JWT do Access |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | **sim** | Sem elas, em produção o formulário fica bloqueado (falha segura) |
| `IP_HASH_SALT` | recomendado | Sal do hash de IP usado no rate limit |
| `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, `LEAD_NOTIFICATION_FROM` | opcional | Aviso por e-mail a cada nova proposta |

## Banco de dados e migrations

- SQL puro em [`migrations/`](migrations) — dialeto SQLite, compatível com **Turso** e **Cloudflare D1**.
- Controle das migrations aplicadas na tabela `d1_migrations` (mesmo formato do Wrangler/D1).
- Valores monetários em **centavos** (inteiro); datas em ISO 8601 UTC; booleanos 0/1.
- Tabelas: `vehicles`, `vehicle_images`, `vehicle_features`, `vehicle_slug_history`, `vehicle_leads`,
  `vehicle_lead_images`, `site_settings`, `admin_audit_log`, `rate_limits`.
- Os dados oficiais da empresa entram pela migration `0002_seed_settings.sql` e depois são editados no painel.
- Todas as consultas usam **parâmetros** (`?`); a UI nunca executa SQL.

## Fotos (armazenamento)

- As fotos **nunca** vão para o banco, Base64 ou Git; o banco guarda só as chaves.
- O navegador corrige a orientação, remove metadados (inclusive GPS), redimensiona e converte para **WebP**
  (JPEG como alternativa): grande até 1920 px (veículos) / 1600 px (propostas) e miniatura de 720 px.
- O servidor **não confia** no navegador: confere o formato real (magic bytes), bytes, dimensões e proporção.
- Chaves: `vehicles/{vehicleId}/{uuid}.webp` · `vehicles/{vehicleId}/{uuid}-thumb.webp` ·
  `sell-leads/{leadId}/{uuid}.webp`. Ao converter uma proposta, as fotos são **copiadas** para `vehicles/`.
- Entrega: fotos de veículos por `/media/...` (cache de 1 ano, CDN); fotos de propostas só por
  `/api/admin/lead-media/...` (exige login, `no-store`).

## Autenticação do painel

- **`AUTH_MODE=password` (padrão)**: senha única com hash **PBKDF2-SHA256** (600 mil iterações no Node/Vercel; 50 mil
  no Workers, limite do runtime); cookie de sessão assinado (HMAC), `HttpOnly`, `Secure`, `SameSite=Strict`, 12 h.
  Trocar a senha ou o `SESSION_SECRET` derruba todas as sessões. Tentativas de login limitadas por IP (o IP é lido só
  do header garantido pela plataforma — `CF-Connecting-IP` no Cloudflare, `X-Real-IP` na Vercel — para não ser forjado).
- A senha de desenvolvimento (`MeM_admin78812`, em `src/config/dev-auth.ts`) só existe no `npm run dev`; em produção
  não há senha no código.
- **`AUTH_MODE=cloudflare-access` (opcional)**: o Cloudflare Access protege `/admin/*` e `/api/admin/*` na borda e o
  servidor **também** valida o JWT (`Cf-Access-Jwt-Assertion`) — não basta esconder o link.

## Anti-spam (Turnstile + rate limit)

Formulário público protegido por: limite de tamanho da requisição, **rate limit por IP** (5/h e 15/dia; IP guardado só
como hash), honeypot, **Cloudflare Turnstile** validado no servidor e validação completa com Zod. Requisições que alteram
dados só são aceitas da própria origem (proteção CSRF).

## Testes

```bash
npm test          # 131 testes: slug, dinheiro, schemas, WhatsApp, filtros, ofertas/repasses, imagens,
                  # auth/CSP + integração (veículos, propostas, conversão, fotos, configurações, rate limit)
npm run test:e2e  # 29 testes Playwright: compra, ofertas, repasses, anunciar+proposta, admin→converter→publicar,
                  # celular, headers/CSP/CSRF e ausência de rolagem horizontal em 11 larguras (320→1920 px)
```

- O E2E sobe um servidor próprio com banco/fotos isolados (`.data/e2e*`) e senha de teste.
- O servidor E2E roda com `--ignore-lock`, então pode coexistir com um `npm run dev` aberto.
- Usa o navegador instalado (Edge no Windows, Chrome nos demais) — não baixa navegadores. Para outro Chromium:
  `E2E_EXECUTABLE_PATH=/caminho/do/chromium npm run test:e2e`. Contra o Worker local ou publicado:
  `E2E_BASE_URL=http://127.0.0.1:8787 E2E_ADMIN_PASSWORD=MeM_admin78812 npm run test:e2e`.

**Lighthouse** (build de produção local): desktop 100/100/100/100; mobile Acessibilidade, Boas práticas e SEO 100 e
Performance 91–97 (sem compressão local). Detalhes e ressalvas em [docs/AUDITORIA.md](docs/AUDITORIA.md).

## Preview, produção e domínio

Fluxo: **desenvolver local → `npm run cf:deploy` (URL `*.workers.dev`) → validar com o cliente → comprar domínio →
domínio próprio no Worker**. O sistema não depende do domínio: sem `PUBLIC_SITE_URL`, usa a URL da requisição.

- Passo a passo completo (D1, KV/R2, segredos, Turnstile, domínio, Access): **[docs/DEPLOY-CLOUDFLARE.md](docs/DEPLOY-CLOUDFLARE.md)**.
- **Deploy automático:** `.github/workflows/deploy-cloudflare.yml` publica a cada push na `main` depois de lint, tipos
  e testes — basta cadastrar `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` nos secrets do repositório.
  `.github/workflows/ci.yml` verifica cada branch/PR (lint, formatação, tipos, testes, builds e E2E).
- Alternativa Vercel: [docs/DEPLOY.md](docs/DEPLOY.md).

## Custos e planos gratuitos

Limites consultados na documentação oficial em **24/09/2026**. Planos gratuitos mudam — **não há garantia de gratuidade
permanente**; revise periodicamente.

| Serviço | Plano gratuito (resumo) | Fonte |
| --- | --- | --- |
| Cloudflare Workers | 100 mil requisições/dia, 10 ms de CPU por requisição; arquivos estáticos ilimitados. **Uso comercial permitido** | [developers.cloudflare.com/workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Cloudflare D1 | 5 GB, 5 mi de linhas lidas/dia, 100 mil gravações/dia | [developers.cloudflare.com/d1/platform/pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Workers KV (fotos) | 1 GB, 100 mil leituras/dia, 1.000 gravações/dia | [developers.cloudflare.com/kv/platform/pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| Cloudflare R2 (opcional) | 10 GB, 1 mi de operações classe A e 10 mi classe B /mês, **egress grátis** | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/) |
| Cloudflare Turnstile | Gratuito: até 20 widgets, desafios ilimitados | [developers.cloudflare.com/turnstile/plans](https://developers.cloudflare.com/turnstile/plans/) |
| Cloudflare Access (opcional) | Até 50 usuários grátis | [cloudflare.com/plans/zero-trust-services](https://www.cloudflare.com/plans/zero-trust-services/) |
| Vercel Hobby (alternativa) | 100 GB de transferência, 1 mi de invocações/mês. **Somente uso não comercial** | [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) |

**Estimativa de uso da M&M** (estoque de dezenas de veículos): cada foto gera 2–3 gravações no KV (grande, miniatura
e imagem de compartilhamento). ~20 veículos/mês × 15 fotos ≈ 900 gravações **por mês** — o limite do KV é 1.000
**por dia**. Uma página custa 1 requisição de Worker + 1 por foto exibida; as fotos ficam 1 ano no cache do navegador.

**Custo obrigatório previsto:** apenas o **domínio** (ex.: `.com.br` no Registro.br).

## Backup e restauração

- **Cloudflare:** `npm run cf:backup` (D1 em SQL + todas as fotos) e `npm run cf:restore -- backups/<pasta>
  [--media-only]`. O D1 também tem **Time Travel** (restauração pontual dos últimos 7 dias no plano gratuito).
- **Node/Vercel:** `npm run db:backup` → banco em JSON + SQL; `-- --with-media` inclui todas as fotos;
  `npm run db:restore -- backups/<pasta> [--with-media] [--yes]`.
- Procedimentos completos (produção, Blob, R2, D1): [docs/BACKUP.md](docs/BACKUP.md).

## Estrutura de pastas

```
src/
  components/   UI (brand, layout, vehicle, inventory, home, forms, admin, seo, ui)
  layouts/      BaseLayout (site) e AdminLayout (painel)
  pages/        rotas do site, painel (/admin) e APIs (/api)
  features/     scripts de navegador (galeria, filtros, favoritos, formulário, fotos do admin)
  services/     regras de negócio
  repositories/ acesso ao banco (SQL parametrizado)
  schemas/      validação (Zod) e filtros de URL
  lib/          db, storage, auth, turnstile, seo, erros
  server/       middleware helpers, config (astro:env), container de dependências, platform/ (Node × Workers)
  config/       catálogo (categorias, combustíveis…), navegação, padrões
  types/ utils/ styles/
migrations/     SQL (SQLite/D1)
scripts/        migrate, seed, backup/restore, hash de senha, segredos do Cloudflare, logo, servidor E2E
.github/        CI (verificação) e deploy automático no Cloudflare
tests/          unit/, integration/, e2e/
docs/           DEPLOY-CLOUDFLARE, DEPLOY (Vercel), MANUAL_ADMIN, ARQUITETURA, BACKUP, AUDITORIA, brand/
public/         logo, ícones, manifest, og-default.jpg
```

## Dados que ainda faltam

Não foram inventados e **não aparecem** no site até serem cadastrados no painel (Configurações):
endereço completo, horário de funcionamento. Também ficam para depois: domínio definitivo, CNPJ (se desejarem exibir),
história/tempo de mercado, avaliações e parceiros financeiros.

**Logo:** o arquivo original não estava na pasta do projeto; a versão vetorial (fundo transparente) foi recriada a
partir da logo do perfil oficial do Instagram, preservando símbolo, cores e tipografia (referências em `docs/brand/`).
Se houver o arquivo original em alta resolução, coloque-o em `docs/brand/` para conferência e ajuste fino
(`scripts/build-logo.ts` → `npm run brand:logo`).

**Fotos reais:** o hero e os cards usam automaticamente as fotos reais dos veículos cadastrados como destaque.
