# M&M Veículos — site e painel administrativo

Site comercial e painel de gestão da **M&M Veículos** (Massaranduba - SC): estoque de carros, motos, scooters,
pesados e máquinas agrícolas, **ofertas**, **repasses**, **favoritos**, formulário **“Anuncie seu veículo”** com
fotos, e painel para gerenciar veículos, propostas e dados da empresa.

> “Construindo credibilidade a cada negociação.”

- Documentação de publicação: [docs/DEPLOY.md](docs/DEPLOY.md)
- Manual do administrador (linguagem simples): [docs/MANUAL_ADMIN.md](docs/MANUAL_ADMIN.md)
- Arquitetura e migração futura para Cloudflare: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)
- Backup e restauração: [docs/BACKUP.md](docs/BACKUP.md)
- Auditoria final (segurança, performance, SEO, acessibilidade…): [docs/AUDITORIA.md](docs/AUDITORIA.md)

---

## Sumário

1. [O que o sistema faz](#o-que-o-sistema-faz)
2. [Stack](#stack)
3. [Por que Vercel agora (e o plano Cloudflare)](#por-que-vercel-agora-e-o-plano-cloudflare)
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
| CSS | **Tailwind CSS 4** + design system próprio (preto/grafite + dourado da logo) |
| Hospedagem (agora) | **Vercel** (Functions Node.js + CDN) via `@astrojs/vercel` |
| Banco | **libSQL/SQLite** — local em arquivo; produção no **Turso** (mesmo dialeto do Cloudflare D1) |
| Fotos | Abstração com 3 drivers: **local**, **Vercel Blob (privado)**, **S3/Cloudflare R2** |
| Admin/Auth | Senha única com hash PBKDF2 + sessão assinada (agora) · **Cloudflare Access** já implementado para a migração |
| Anti-spam | **Cloudflare Turnstile** + rate limit no banco + honeypot + validação no servidor |
| Validação | **Zod 4** |
| Testes | **Vitest** (unitários + integração com banco real em memória) e **Playwright** (E2E) |

## Por que Vercel agora (e o plano Cloudflare)

O pedido original priorizava o ecossistema Cloudflare; a decisão atual foi **publicar pela Vercel por enquanto**.
O código foi escrito para que a troca futura não exija reconstrução:

| Peça | Agora (Vercel) | Depois (Cloudflare) | Esforço da troca |
| --- | --- | --- | --- |
| Hospedagem | Vercel Functions | Workers (`@astrojs/cloudflare`) | Trocar o adapter |
| Banco | Turso (libSQL/SQLite) | D1 (SQLite) | Mesmas migrations; adaptador D1 da interface `Database` |
| Fotos | Vercel Blob privado **ou** R2 (driver `s3` já pronto) | R2 | Nenhum código — só variáveis |
| Admin | Senha + sessão | Cloudflare Access (`AUTH_MODE=cloudflare-access`, já implementado) | Só variáveis |
| Anti-spam | Turnstile | Turnstile | Nenhum |

> ⚠️ **Importante sobre custo:** pelas [regras de uso justo da Vercel](https://vercel.com/docs/limits/fair-use-guidelines),
> o **plano Hobby (gratuito) é apenas para uso pessoal e não comercial**. Ele serve para desenvolvimento, previews e
> validação com o cliente. Para o site comercial em produção há duas opções: **Vercel Pro** (US$ 20/mês por membro) ou
> **migrar para a Cloudflare**, cujo plano gratuito não tem essa restrição — veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md#migração-para-cloudflare).

## Arquitetura resumida

```
Navegador ──► CDN (cache de páginas 60 s + fotos 1 ano)
                 │
                 ▼
          middleware.ts  → CSRF (origem), autenticação do /admin, headers de segurança, cache
                 │
          pages/ (Astro)  → só apresentação: chama serviços, nunca SQL
                 │
          services/       → regras de negócio (oferta ativa, publicação, conversão proposta→veículo…)
                 │
     repositories/  +  lib/storage/        → SQL parametrizado  |  fotos (local / Blob / S3-R2)
                 │                 │
          lib/db (libSQL/Turso)   Vercel Blob privado ou R2
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

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (gera `.vercel/output`) |
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

| Variável | Obrigatória em produção | Descrição |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | ao ter domínio | URL canônica (ex.: `https://www.mmveiculos.com.br`). Vazia = usa a URL da requisição |
| `ALLOW_INDEXING` | — | `true` só no domínio definitivo. Enquanto `false`, `robots.txt` bloqueia buscadores |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | sim | Turso (`libsql://…`) |
| `STORAGE_DRIVER` | sim | `vercel-blob` ou `s3` (`local` só em desenvolvimento) |
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

- **Agora (`AUTH_MODE=password`)**: senha única com hash **PBKDF2-SHA256 (600 mil iterações)**; cookie de sessão
  assinado (HMAC), `HttpOnly`, `Secure`, `SameSite=Strict`, 12 h. Trocar a senha ou o `SESSION_SECRET` derruba todas
  as sessões. Tentativas de login limitadas por IP. Não existe senha no código.
- **Depois (`AUTH_MODE=cloudflare-access`)**: o Cloudflare Access protege `/admin/*` e `/api/admin/*` na borda e o
  servidor **também** valida o JWT (`Cf-Access-Jwt-Assertion`) — não basta esconder o link.

## Anti-spam (Turnstile + rate limit)

Formulário público protegido por: limite de tamanho da requisição, **rate limit por IP** (5/h e 15/dia; IP guardado só
como hash), honeypot, **Cloudflare Turnstile** validado no servidor e validação completa com Zod. Requisições que alteram
dados só são aceitas da própria origem (proteção CSRF).

## Testes

```bash
npm test          # 128 testes: slug, dinheiro, schemas, WhatsApp, filtros, ofertas/repasses, imagens,
                  # auth/CSP + integração (veículos, propostas, conversão, fotos, configurações, rate limit)
npm run test:e2e  # 29 testes Playwright: compra, ofertas, repasses, anunciar+proposta, admin→converter→publicar,
                  # celular, headers/CSP/CSRF e ausência de rolagem horizontal em 11 larguras (320→1920 px)
```

- O E2E sobe um servidor próprio com banco/fotos isolados (`.data/e2e*`) e senha de teste.
- **Pare o `npm run dev` antes do `npm run test:e2e`** (o Astro não permite dois servidores dev no mesmo projeto).
- Usa o navegador instalado (Edge no Windows, Chrome nos demais) — não baixa navegadores.

**Lighthouse** (build de produção local): desktop 100/100/100/100; mobile Acessibilidade, Boas práticas e SEO 100 e
Performance 91–97 (sem compressão local). Detalhes e ressalvas em [docs/AUDITORIA.md](docs/AUDITORIA.md).

## Preview, produção e domínio

O fluxo é: **desenvolver local → preview na Vercel → validar com o cliente → configurar produção → comprar domínio →
publicar**. O sistema não depende do domínio: sem `PUBLIC_SITE_URL`, usa a URL da requisição. Passo a passo completo
(Turso, Blob, Turnstile, variáveis, região, domínio, Search Console): **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Custos e planos gratuitos

Limites consultados na documentação oficial em **24/09/2026**. Planos gratuitos mudam — **não há garantia de gratuidade
permanente**; revise periodicamente.

| Serviço | Plano gratuito (resumo) | Fonte |
| --- | --- | --- |
| Vercel Hobby | 100 GB Fast Data Transfer, 1 mi de invocações de função, 4 h de CPU ativa, 1 mi de Edge Requests /mês. **Uso não comercial.** | [vercel.com/docs/plans/hobby](https://vercel.com/docs/plans/hobby) |
| Vercel Blob (Hobby) | 1 GB armazenado, 10 mil operações simples, 2 mil operações avançadas (uploads), 10 GB de transferência /mês | [vercel.com/docs/vercel-blob/usage-and-pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) |
| Turso Free | 100 bancos, 5 GB, 500 mi de linhas lidas e 10 mi escritas /mês, restauração de 1 dia | [turso.tech/pricing](https://turso.tech/pricing) |
| Cloudflare Turnstile | Gratuito: até 20 widgets, desafios ilimitados | [developers.cloudflare.com/turnstile/plans](https://developers.cloudflare.com/turnstile/plans/) |
| Cloudflare R2 (alternativa ao Blob) | 10 GB, 1 mi de operações classe A e 10 mi classe B /mês, **egress grátis** | [developers.cloudflare.com/r2/pricing](https://developers.cloudflare.com/r2/pricing/) |
| Cloudflare Workers (futuro) | 100 mil requisições/dia, 10 ms de CPU por requisição; assets estáticos ilimitados | [developers.cloudflare.com/workers/platform/pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Cloudflare D1 (futuro) | 5 mi linhas lidas/dia, 100 mil escritas/dia, 5 GB | [developers.cloudflare.com/d1/platform/pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Cloudflare Access (futuro) | Até 50 usuários grátis | [cloudflare.com/plans/zero-trust-services](https://www.cloudflare.com/plans/zero-trust-services/) |

**Estimativa de uso da M&M** (estoque de dezenas de veículos): cada foto gera 2 uploads (grande + miniatura).
Com ~20 veículos/mês × 15 fotos = 600 uploads, mais ~50 propostas × 6 fotos = 600 → ~1.200 operações avançadas no
Blob (limite 2.000). Se o volume crescer, use o driver **R2** (1 milhão de operações). Páginas ficam 60 s no cache da
CDN e fotos 1 ano, o que reduz invocações e leituras de banco.

**Custo obrigatório previsto:** apenas o **domínio** (ex.: `.com.br` no Registro.br) — somado à questão comercial do
plano Hobby explicada acima.

## Backup e restauração

- `npm run db:backup` → banco em JSON + SQL; `-- --with-media` inclui todas as fotos.
- `npm run db:restore -- backups/<pasta> [--with-media] [--yes]`.
- Turso ainda oferece restauração pontual (1 dia no plano gratuito).
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
  server/       middleware helpers, config (astro:env), container de dependências
  config/       catálogo (categorias, combustíveis…), navegação, padrões
  types/ utils/ styles/
migrations/     SQL (SQLite/D1)
scripts/        migrate, seed, backup/restore, hash de senha, logo, servidor E2E
tests/          unit/, integration/, e2e/
docs/           DEPLOY, MANUAL_ADMIN, ARQUITETURA, BACKUP, AUDITORIA, brand/
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
