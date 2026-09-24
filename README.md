# M&M Veículos — site e painel administrativo

Site comercial e painel de gestão da **M&M Veículos** (Massaranduba - SC): estoque de carros, motos, scooters,
pesados e máquinas agrícolas, **ofertas**, **repasses**, **favoritos**, formulário **“Anuncie seu veículo”** com
fotos, e painel para gerenciar veículos, propostas e dados da empresa.

> “Construindo credibilidade a cada negociação.”

**No ar (URL temporária de validação):** https://mm-veiculos.visor-crypto.workers.dev · painel em `/admin`

| Documento                                              | Conteúdo                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [docs/RELATORIO_ENTREGA.md](docs/RELATORIO_ENTREGA.md) | **O que está pronto, o que foi verificado e o que falta para entregar ao cliente** |
| [docs/DEPLOY.md](docs/DEPLOY.md)                       | Publicação na **Cloudflare** (principal): deploy, senha, domínio, R2, limites      |
| [docs/MANUAL_ADMIN.md](docs/MANUAL_ADMIN.md)           | Manual do painel em linguagem simples (para a M&M)                                 |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md)             | Camadas, modelo de dados, fotos, cache, portabilidade                              |
| [docs/BACKUP.md](docs/BACKUP.md)                       | Backup e restauração (Cloudflare e alternativas)                                   |
| [docs/AUDITORIA.md](docs/AUDITORIA.md)                 | Auditoria final: segurança, performance, SEO, acessibilidade                       |
| [docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)         | Alternativa: Vercel + Turso + Blob                                                 |

---

## Sumário

1. [O que o sistema faz](#o-que-o-sistema-faz)
2. [Stack](#stack)
3. [Hospedagem: Cloudflare (principal) e alternativas](#hospedagem-cloudflare-principal-e-alternativas)
4. [Arquitetura resumida](#arquitetura-resumida)
5. [Instalação e desenvolvimento local](#instalação-e-desenvolvimento-local)
6. [Scripts](#scripts)
7. [Variáveis de ambiente](#variáveis-de-ambiente)
8. [Banco de dados e migrations](#banco-de-dados-e-migrations)
9. [Fotos](#fotos)
10. [Autenticação do painel](#autenticação-do-painel)
11. [Anti-spam (Turnstile + rate limit)](#anti-spam-turnstile--rate-limit)
12. [Testes](#testes)
13. [Custos e planos gratuitos](#custos-e-planos-gratuitos)
14. [Estrutura de pastas](#estrutura-de-pastas)
15. [Dados que ainda faltam](#dados-que-ainda-faltam)

---

## O que o sistema faz

**Site público**

| Rota                                               | Conteúdo                                                                                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`                                                | Hero com busca, atalhos por categoria, destaques, ofertas, repasses (só aparece se houver), “Quer vender seu veículo?”, bloco da empresa         |
| `/estoque`                                         | Estoque com busca (marca/modelo/versão), filtros, ordenação e paginação — tudo na URL (`/estoque?marca=Toyota`, `?oferta=true`, `?repasse=true`) |
| `/veiculo/[slug]`                                  | Galeria (swipe, setas, miniaturas, tela cheia), ficha técnica, opcionais, “Tenho interesse” no WhatsApp, vendido → “Procurando algo parecido?”   |
| `/ofertas`                                         | Veículos em oferta ativa, com “De R$ X por R$ Y” quando houver preço anterior                                                                    |
| `/repasses`                                        | Veículos com tipo comercial “repasse” + texto configurável                                                                                       |
| `/anuncie-seu-veiculo`                             | Formulário de proposta com até 6 fotos (comprimidas no navegador), Turnstile e consentimento LGPD                                                |
| `/favoritos`                                       | Favoritos salvos no navegador (sem login)                                                                                                        |
| `/empresa`, `/contato`, `/politica-de-privacidade` | Institucional                                                                                                                                    |
| `/sitemap.xml`, `/robots.txt`                      | Gerados dinamicamente                                                                                                                            |

**Painel (`/admin`)** — Dashboard, Veículos (lista com filtros e ações rápidas), Novo veículo, fotos (upload múltiplo,
arrastar, reordenar, capa, excluir), Propostas (status, WhatsApp do cliente, anotações, **transformar em veículo**,
exclusão LGPD), Ofertas e Repasses (filtros da lista), Configurações (contatos, redes, textos).

**Destaque, Oferta e Repasse são independentes**: `featured`, `is_offer` (+ período e preço anterior) e
`commercial_type = normal | repasse`. Um carro pode ser destaque + oferta, só repasse, os três, etc.

## Stack

| Camada          | Tecnologia                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| Front-end / SSR | **Astro 7** (Islands — JavaScript só onde há interação, sem framework no cliente)          |
| Linguagem       | **TypeScript strict** (`astro/tsconfigs/strictest`)                                        |
| CSS             | **Tailwind CSS 4** + design system próprio (preto/grafite + dourado da logo)               |
| Hospedagem      | **Cloudflare Workers** (`@astrojs/cloudflare`) — alternativas prontas: Vercel e Node       |
| Banco           | **Cloudflare D1** (SQLite) — local em arquivo libSQL; Turso na alternativa Vercel          |
| Fotos           | Interface `ObjectStorage` com drivers **KV**, **R2**, S3, Vercel Blob e local              |
| Admin/Auth      | Senha única (PBKDF2) + sessão assinada · **Cloudflare Access** já implementado             |
| Anti-spam       | **Cloudflare Turnstile** + rate limit no banco + honeypot + validação no servidor          |
| Validação       | **Zod 4**                                                                                  |
| Testes          | **Vitest** (unitários + integração, inclusive adaptadores D1/KV/R2) e **Playwright** (E2E) |

## Hospedagem: Cloudflare (principal) e alternativas

O site roda **na Cloudflare, no plano gratuito** (uso comercial permitido): Workers + D1 + KV/R2 + Turnstile. O mesmo
código também compila para Vercel e para um servidor Node — a plataforma é escolhida no build por `DEPLOY_TARGET`:

| `DEPLOY_TARGET` | Adapter               | Banco             | Fotos                           | Uso                                                                                                  |
| --------------- | --------------------- | ----------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `cloudflare`    | `@astrojs/cloudflare` | D1 (binding `DB`) | KV (`MEDIA_KV`) ou R2 (`MEDIA`) | **Produção** (`npm run cf:deploy`)                                                                   |
| `vercel`        | `@astrojs/vercel`     | Turso (libSQL)    | Vercel Blob ou S3/R2            | Alternativa ([DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)); o plano Hobby da Vercel é **não comercial** |
| `node` (padrão) | `@astrojs/node`       | arquivo libSQL    | disco local                     | Desenvolvimento, testes E2E, `preview:local`                                                         |

Só `src/server/platform/` conhece a plataforma; serviços e repositórios usam as interfaces `Database` e
`ObjectStorage`. Guia completo: **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Arquitetura resumida

```
Navegador ──► Cloudflare (borda mais próxima)
                 │  arquivos estáticos (CSS/JS/logo) servidos direto, sem Worker
                 ▼
          Worker (Astro SSR)
          middleware.ts  → cache de borda (domínio próprio) · CSRF · auth do /admin · headers de segurança
                 │
          pages/          → só apresentação: chama serviços, nunca SQL
          services/       → regras de negócio (oferta ativa, publicação, conversão proposta→veículo…)
          repositories/   → SQL parametrizado          lib/storage/ → fotos
                 │                                           │
          D1 (SQLite)                                   KV ou R2 (privados)
```

Detalhes, modelo de dados e decisões: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Instalação e desenvolvimento local

Requisitos: **Node.js 22.12+** (testado com Node 24) e npm.

```bash
npm install
cp .env.example .env              # no Windows: copy .env.example .env
npm run admin:hash-password       # gera ADMIN_PASSWORD_HASH, SESSION_SECRET e IP_HASH_SALT -> cole no .env
npm run db:migrate                # cria .data/dev.db
npm run db:seed:demo              # (opcional) veículos e propostas de DEMONSTRAÇÃO, só no banco local
npm run dev                       # http://localhost:4321  —  painel em http://localhost:4321/admin
```

- Em desenvolvimento o Turnstile usa automaticamente as **chaves de teste oficiais** da Cloudflare.
- As fotos ficam em `.data/uploads` (driver `local`). Nada disso vai para o Git.
- O seed de demonstração **recusa** rodar em banco remoto e marca tudo como “FOTO DEMONSTRATIVA”.
- Para recomeçar do zero: `npm run db:reset`.
- Para testar no runtime da Cloudflare (workerd, D1/KV simulados): `npm run cf:dev`.

## Scripts

| Comando                                            | O que faz                                                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`                                      | Servidor de desenvolvimento (Node)                                                              |
| `npm run cf:dev`                                   | Desenvolvimento dentro do runtime da Cloudflare (D1/KV locais)                                  |
| `npm run cf:deploy`                                | **Publica na Cloudflare**: migrations no D1 remoto + build + `wrangler deploy`                  |
| `npm run cf:build`                                 | Só o build para Workers                                                                         |
| `npm run cf:migrate` / `cf:migrate:local`          | Migrations no D1 remoto / local                                                                 |
| `npm run cf:backup` / `cf:restore`                 | Backup e restauração da produção (D1 + fotos) — [docs/BACKUP.md](docs/BACKUP.md)                |
| `npm run build`                                    | Build Node (`DEPLOY_TARGET=vercel` para a Vercel)                                               |
| `npm run vercel-build`                             | Usado pela Vercel: migrations no Turso + build                                                  |
| `npm run preview:local`                            | Build de **produção** rodando localmente (Node) em http://localhost:4330 — útil para Lighthouse |
| `npm run typecheck`                                | `astro check` (TypeScript + templates)                                                          |
| `npm run lint` / `lint:fix`                        | ESLint                                                                                          |
| `npm run format` / `format:check`                  | Prettier                                                                                        |
| `npm test`                                         | Testes unitários + integração (Vitest)                                                          |
| `npm run test:e2e`                                 | Testes E2E (Playwright, usa o Edge/Chrome instalado)                                            |
| `npm run verify`                                   | lint + typecheck + testes + build                                                               |
| `npm run db:migrate` / `db:seed:demo` / `db:reset` | Banco local (libSQL)                                                                            |
| `npm run db:backup` / `db:restore`                 | Backup/restauração do banco libSQL/Turso                                                        |
| `npm run admin:hash-password`                      | Hash da senha do painel (`-- --cloudflare` para o Workers)                                      |
| `npm run brand:logo`                               | Regenera logo SVG/PNG, favicons e imagem Open Graph                                             |

## Variáveis de ambiente

- **Cloudflare:** variáveis públicas em [`wrangler.jsonc`](wrangler.jsonc) → `vars`; valores sigilosos como
  **secrets** do Worker (`npx wrangler secret put NOME`). Nada sigiloso fica no Git.
- **Local / Vercel / Node:** [`.env.example`](.env.example) documenta todas.

| Variável                                                                                    | Onde (Cloudflare) | Descrição                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `PUBLIC_SITE_URL`                                                                           | vars              | URL canônica (ex.: `https://www.mmveiculos.com.br`). Vazia = URL da requisição                        |
| `ALLOW_INDEXING`                                                                            | vars              | `true` só no domínio definitivo. Enquanto `false`, `robots.txt` e `X-Robots-Tag` bloqueiam buscadores |
| `STORAGE_DRIVER`                                                                            | vars              | `kv` ou `r2` na Cloudflare; `vercel-blob`, `s3` ou `local` nas demais                                 |
| `AUTH_MODE`                                                                                 | vars              | `password` (padrão) ou `cloudflare-access`                                                            |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`                                                     | secrets           | Gerados por `npm run admin:hash-password -- --cloudflare`                                             |
| `IP_HASH_SALT`                                                                              | secret            | Sal do hash de IP usado no rate limit                                                                 |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`                                               | vars / secret     | Sem elas, em produção o formulário fica bloqueado (falha segura)                                      |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAILS`                                    | vars              | Só com `cloudflare-access`                                                                            |
| `RESEND_API_KEY` / `LEAD_NOTIFICATION_EMAIL`, `LEAD_NOTIFICATION_FROM`                      | secret / vars     | Opcional: aviso de nova proposta por e-mail                                                           |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `S3_*`, `LOCAL_STORAGE_DIR` | —                 | Só nas plataformas Node/Vercel                                                                        |
| `DEPLOY_TARGET`                                                                             | (build)           | `cloudflare`, `vercel` ou `node` — definido pelos scripts                                             |

## Banco de dados e migrations

- SQL puro em [`migrations/`](migrations) — dialeto SQLite, igual no **D1**, no Turso e no arquivo local.
- Controle na tabela `d1_migrations` (formato do Wrangler). `npm run cf:deploy` aplica as pendentes antes de publicar.
- Valores monetários em **centavos** (inteiro); datas em ISO 8601 UTC; booleanos 0/1.
- Tabelas: `vehicles`, `vehicle_images`, `vehicle_features`, `vehicle_slug_history`, `vehicle_leads`,
  `vehicle_lead_images`, `site_settings`, `admin_audit_log`, `rate_limits`.
- Os dados oficiais da empresa entram pela migration `0002_seed_settings.sql` e depois são editados no painel.
- Todas as consultas usam **parâmetros** (`?`); a UI nunca executa SQL. Consultas independentes de uma página rodam
  em paralelo (no Workers cada consulta ao D1 é uma ida e volta pela rede).

## Fotos

- As fotos **nunca** vão para o banco, Base64 ou Git; o banco guarda só as chaves.
- O navegador corrige a orientação, remove metadados (inclusive GPS), redimensiona e converte para **WebP** (JPEG como
  alternativa). Veículos: grande (até 1920 px), **média (1080 px, celulares)**, miniatura (720 px) e imagem de
  compartilhamento (JPEG 1200×630 com a logo). Propostas: grande (1600 px) e miniatura.
- O servidor **não confia** no navegador: confere o formato real (magic bytes), bytes, dimensões e proporção.
- Chaves: `vehicles/{vehicleId}/{uuid}.webp`, `…-md.webp`, `…-thumb.webp`, `…-og.jpg` ·
  `sell-leads/{leadId}/{uuid}.webp`. Ao converter uma proposta, as fotos são **copiadas** para `vehicles/`.
- Entrega: fotos de veículos por `/media/...` (cache imutável de 1 ano); fotos de propostas só por
  `/api/admin/lead-media/...` (exige login, `no-store`). O storage é sempre privado.

## Autenticação do painel

- **`AUTH_MODE=password`** (atual): senha única com hash **PBKDF2-SHA256** (50 mil iterações no Workers, 600 mil em
  Node); cookie de sessão assinado (HMAC), `HttpOnly`, `Secure`, `SameSite=Strict`, 12 h. Trocar a senha ou o
  `SESSION_SECRET` derruba todas as sessões. Tentativas de login limitadas por IP. Não existe senha no código.
- **`AUTH_MODE=cloudflare-access`**: o Cloudflare Access protege `/admin*` e `/api/admin/*` na borda e o servidor
  **também** valida o JWT (`Cf-Access-Jwt-Assertion`) — ideal para vários usuários, cada um com seu e-mail.

## Anti-spam (Turnstile + rate limit)

Formulário público protegido por: limite de tamanho da requisição, **rate limit por IP** (5/h e 15/dia; IP guardado só
como hash), honeypot, **Cloudflare Turnstile** validado no servidor e validação completa com Zod. Requisições que alteram
dados só são aceitas da própria origem (proteção CSRF).

## Testes

```bash
npm test          # 140 testes: slug, dinheiro, schemas, WhatsApp, filtros, ofertas/repasses, imagens (4 versões),
                  # auth/CSP, cache de borda + integração (veículos, propostas, conversão, fotos, configurações,
                  # rate limit) + adaptadores Cloudflare (D1, KV, R2, cota diária do KV)
npm run test:e2e  # 29 testes Playwright: compra, ofertas, repasses, anunciar+proposta, admin→converter→publicar,
                  # celular, headers/CSP/CSRF e ausência de rolagem horizontal em 11 larguras (320→1920 px)
```

- O E2E sobe um servidor próprio com banco/fotos isolados (`.data/e2e*`) e senha de teste.
- **Pare o `npm run dev` antes do `npm run test:e2e`** (o Astro não permite dois servidores dev no mesmo projeto).
- Usa o navegador instalado (Edge no Windows, Chrome nos demais) — não baixa navegadores.

**Lighthouse na Cloudflare (URL publicada):** desktop 100 em todas as páginas; mobile 97–100 em Performance e 100 em
Acessibilidade e Boas práticas. Detalhes em [docs/AUDITORIA.md](docs/AUDITORIA.md).

## Custos e planos gratuitos

Limites consultados na documentação oficial da Cloudflare em **24/09/2026**. Planos gratuitos mudam — **não há
garantia de gratuidade permanente**; revise periodicamente.

| Serviço             | Plano gratuito (resumo)                                                                            | Fonte                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Workers             | 100 mil requisições/dia, 10 ms de CPU por requisição; estáticos ilimitados                         | [workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/)                                                         |
| D1                  | 5 mi linhas lidas/dia, 100 mil escritas/dia, 500 MB por banco (5 GB por conta), Time Travel 7 dias | [d1/platform/pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Workers KV          | 100 mil leituras/dia, 1 mil gravações/dia, 1 GB                                                    | [kv/platform/pricing](https://developers.cloudflare.com/kv/platform/pricing/)                                                                   |
| R2                  | 10 GB, 1 mi operações classe A e 10 mi classe B /mês, saída grátis                                 | [r2/pricing](https://developers.cloudflare.com/r2/pricing/)                                                                                     |
| Turnstile           | Gratuito                                                                                           | [turnstile/plans](https://developers.cloudflare.com/turnstile/plans/)                                                                           |
| Access (Zero Trust) | Até 50 usuários                                                                                    | [plans/zero-trust-services](https://www.cloudflare.com/plans/zero-trust-services/)                                                              |

**Estimativa de uso da M&M:** uma visita típica gera ~5–15 requisições ao Worker (HTML + fotos; CSS/JS não contam) →
capacidade de milhares de visitas por dia. O ponto de atenção é o **KV: 1.000 gravações/dia ≈ 250 fotos de veículo
por dia** (cada foto gera 4 arquivos). Para o cadastro inicial do estoque, ative o **R2** (passo 7 do
[DEPLOY.md](docs/DEPLOY.md#7-ativar-o-r2-para-as-fotos-recomendado)).

**Custo obrigatório:** apenas o **domínio** (ex.: `.com.br` no Registro.br). Se um dia o tráfego passar dos limites
gratuitos, o plano Workers Paid custa US$ 5/mês por conta.

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
  lib/          db (libSQL, D1), storage (KV, R2, S3, Blob, local), auth, turnstile, seo, erros
  server/       platform/ (cloudflare | node), middleware helpers, cache de borda, config, container
  config/       catálogo (categorias, combustíveis…), navegação, padrões
  types/ utils/ styles/
migrations/     SQL (SQLite/D1)
scripts/        cf (deploy), cf-backup, migrate, seed, backup/restore, hash de senha, logo, servidor E2E
tests/          unit/, integration/, e2e/
docs/           DEPLOY, RELATORIO_ENTREGA, MANUAL_ADMIN, ARQUITETURA, BACKUP, AUDITORIA, DEPLOY-VERCEL, brand/
public/         logo, ícones, manifest, og-default.jpg
wrangler.jsonc  configuração do Worker (bindings D1/KV/R2 e variáveis públicas)
```

## Dados que ainda faltam

Não foram inventados e **não aparecem** no site até serem cadastrados no painel (Configurações):
endereço completo, horário de funcionamento. Também ficam para depois: domínio definitivo, CNPJ (se desejarem exibir),
história/tempo de mercado, avaliações e parceiros financeiros. Lista completa em
[docs/RELATORIO_ENTREGA.md](docs/RELATORIO_ENTREGA.md).

**Logo:** o arquivo original não estava na pasta do projeto; a versão vetorial (fundo transparente) foi recriada a
partir da logo do perfil oficial do Instagram, preservando símbolo, cores e tipografia (referências em `docs/brand/`).
Se houver o arquivo original em alta resolução, coloque-o em `docs/brand/` para conferência e ajuste fino
(`scripts/build-logo.ts` → `npm run brand:logo`).

**Fotos reais:** o hero e os cards usam automaticamente as fotos reais dos veículos cadastrados como destaque.
