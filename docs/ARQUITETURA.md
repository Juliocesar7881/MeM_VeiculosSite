# Arquitetura

## Visão geral

```
┌──────────────┐    ┌──────────────────────── Cloudflare ─────────────────────────┐
│  Navegador   │───►│ Borda mais próxima (São Paulo, Rio…)                         │
│ (JS mínimo)  │    │   /_astro, logo, ícones ─► Static Assets (sem Worker, grátis) │
└──────────────┘    │   páginas públicas     ─► cache de borda 60 s (domínio próprio)│
                    │   ▼                                                           │
                    │ Worker `mm-veiculos` (Astro SSR, Smart Placement)             │
                    │   middleware.ts ─ cache · CSRF · auth /admin · headers        │
                    │   pages/ ─ apresentação (sem SQL)                             │
                    │   services/ ─ regras de negócio                               │
                    │   repositories/ ─ SQL parametrizado   lib/storage/ ─ fotos    │
                    └──────────┬────────────────────────────────────┬──────────────┘
                               ▼                                    ▼
                     D1 `mm-veiculos` (SQLite, ENAM)        KV `MEDIA_KV` ou R2 (privados)
```

Princípios aplicados:

- **UI não executa SQL.** Páginas e endpoints chamam serviços; serviços usam repositórios; só repositórios conhecem SQL.
- **Toda consulta é parametrizada** (`?`), inclusive buscas (`LIKE ? ESCAPE '\'`).
- **Validação no servidor com Zod** em toda entrada (formulários, filtros de URL, JSON do admin).
- **Nenhum segredo no cliente.** Variáveis lidas em tempo de execução via `astro:env/server` (no Workers, dos `vars` e
  secrets do Worker).
- **Injeção de dependências manual** (`src/server/services.ts`): o mesmo código roda no site, nos scripts e nos testes.
- **Plataforma isolada** em `src/server/platform/` (ver abaixo): trocar Cloudflare ↔ Vercel ↔ Node não toca em regras.
- **JavaScript só onde há interação** (Islands): header, galeria, filtros, favoritos, formulário, fotos do admin.
  Todo o resto é HTML renderizado no servidor; filtros e formulários do admin funcionam mesmo sem JavaScript.

## Camadas e pastas

| Pasta                      | Responsabilidade                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages`                | Rotas. Páginas `.astro` (site e painel) e endpoints `.ts` (`/api/*`, `/media/*`, `/og/*`, `sitemap.xml`, `robots.txt`)                                                              |
| `src/middleware.ts`        | Cache de borda, container de dependências, proteção CSRF por origem, autenticação do painel, headers de segurança e cache                                                           |
| `src/services`             | `VehicleService`, `MediaService`, `LeadService` (inclui conversão proposta→veículo), `SettingsService` (cache 30 s), `RateLimiter`, `AuditService`, notificação opcional por e-mail |
| `src/repositories`         | SQL de cada agregado + mapeamento linha → domínio                                                                                                                                   |
| `src/schemas`              | Zod (veículo, proposta, configurações) e parser tolerante dos filtros de URL                                                                                                        |
| `src/lib/db`               | Interface `Database` + implementações **D1** e **libSQL** + migrador compatível com o Wrangler                                                                                      |
| `src/lib/storage`          | Interface `ObjectStorage` + drivers `kv`, `r2`, `s3`, `vercel-blob`, `local` + convenção de chaves                                                                                  |
| `src/lib/auth`             | PBKDF2, sessão HMAC, validação do Cloudflare Access (JWT)                                                                                                                           |
| `src/server/platform`      | `cloudflare.ts` (bindings D1/KV/R2) e `node.ts` (libSQL + drivers Node, `sharp` para OG)                                                                                            |
| `src/server/edge-cache.ts` | Cache API da Cloudflare para páginas públicas                                                                                                                                       |
| `src/features`             | Scripts de navegador (TypeScript, sem framework)                                                                                                                                    |
| `src/components`           | Componentes Astro (design system, cards, galeria, formulários, painel)                                                                                                              |

### Plataformas

`astro.config.mjs` escolhe o adapter por `DEPLOY_TARGET` (`cloudflare`, `vercel` ou `node`). No build Cloudflare, um
alias do Vite troca `@/server/platform` por `platform/cloudflare.ts`, que lê os bindings via
`import { env } from 'cloudflare:workers'`. Assim o bundle do Worker não carrega `node:fs`, `sharp`, `@libsql/client`
nem `@vercel/blob`.

| Peça      | Cloudflare                                                                      | Node / Vercel                                       |
| --------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| Banco     | `createD1Database(env.DB)` — `prepare/bind/all/first/run`, `batch` transacional | `@libsql/client` (arquivo ou Turso)                 |
| Fotos     | `KvStorage(env.MEDIA_KV)` ou `R2Storage(env.MEDIA)` (ou `s3`)                   | `local`, `vercel-blob`, `s3`                        |
| Imagem OG | Gerada no navegador durante o upload                                            | Idem; fotos antigas geradas sob demanda com `sharp` |

Particularidades do Workers já tratadas no código: `Date` fica congelado em 1970 no escopo global do módulo (validações
de data acontecem sempre durante a requisição); limite de 10 ms de CPU (PBKDF2 com 50 mil iterações no Workers);
sem sistema de arquivos (fotos em KV/R2).

## Modelo de dados

```
vehicles ─┬─< vehicle_images        (large_key, medium_key, thumb_key, og_key, dimensões, position — 0 = capa)
          ├─< vehicle_features      (opcionais)
          └─< vehicle_slug_history  (slugs antigos → redirect 301)

vehicle_leads ──< vehicle_lead_images   (propostas "Anuncie seu veículo")
      └── converted_vehicle_id ──► vehicles.id   (vehicles.source_lead_id aponta de volta)

site_settings (chave/valor)   admin_audit_log   rate_limits   d1_migrations
```

Campos principais de `vehicles`: `category` (carro, moto, scooter, pesado, maquina_agricola), `status`
(draft, available, reserved, sold, archived), `published`, `featured`, `is_offer`, `offer_start_at`, `offer_end_at`,
`previous_price`, `price` (centavos), `commercial_type` (normal, repasse), `search_text` (normalizado para busca),
`published_at`, `sold_at`, `deleted_at`.

**Regras de negócio relevantes**

- Visível no site = `published = 1` e status em (available, reserved, sold) e não excluído. Vendido só aparece nas
  listagens se “Mostrar vendidos” estiver ligado, mas o link direto sempre funciona (mostra “Procurando algo parecido?”).
- Publicar um rascunho o torna “Disponível”. Arquivado não pode ficar publicado.
- **Oferta ativa** = `is_offer` e dentro do período (datas opcionais, fuso de Brasília). “De/Por” só com preço anterior
  maior que o atual; percentual arredondado **para baixo** (nunca exagera o desconto).
- **Hierarquia de selos**: Vendido (exclusivo) › Reservado › Oferta › Repasse › Destaque; no máximo 2 por card.
- Slug = marca-modelo-versão-ano + sufixo do id; ao mudar identidade, o slug antigo redireciona (301).
- Excluir veículo = `deleted_at` + remoção das fotos do storage (histórico preservado, registro invisível).
- Proposta nunca é publicada; a conversão cria **rascunho** sem preço e **copia** as fotos para `vehicles/`.

## Fotos

1. **Navegador:** `createImageBitmap(..., { imageOrientation: 'from-image' })` → canvas → WebP (JPEG se o navegador
   não codificar WebP), reduzindo qualidade/dimensão até caber no limite. Metadados EXIF/GPS são descartados.
2. **Versões por foto de veículo:**

   | Versão           | Tamanho                  | Uso                                      |
   | ---------------- | ------------------------ | ---------------------------------------- |
   | grande           | até 1920 px, ≤ 1,2 MB    | galeria em telas grandes, tela cheia     |
   | média            | 1080 px, ≤ 450 KB        | galeria e cards no celular (LCP)         |
   | miniatura        | 720 px, ≤ 250 KB         | cards, faixa de miniaturas               |
   | compartilhamento | JPEG 1200×630 com a logo | prévia no WhatsApp/Facebook (`og:image`) |

   O `srcset` inclui as três primeiras; o navegador escolhe pela largura da tela. A média é opcional (fotos antigas ou
   convertidas de propostas usam grande/miniatura). Fotos de propostas: grande (1600 px) + miniatura.

3. **Envio:** veículos = 1 requisição por foto (≤ 2,5 MB); propostas = até 6 pares no mesmo envio (< 4,3 MB).
4. **Servidor:** `inspectImage` confere assinatura real (WebP/JPEG), bytes, dimensões e proporção entre as versões.
5. **Armazenamento privado;** entrega por `/media/*` (somente chaves `vehicles/<uuid>/<uuid>(-thumb|-md|-og).(webp|jpg)`)
   com `Cache-Control: immutable` de 1 ano. Fotos de propostas só por rota autenticada, `no-store`.
6. **Galeria:** a capa carrega com `fetchpriority="high"` e preload; as fotos seguintes começam com a miniatura e só
   recebem as versões maiores após o carregamento da página (ou no primeiro swipe) — a capa não disputa banda no 4G.

## Segurança (resumo)

Detalhes e resultado da verificação em [AUDITORIA.md](AUDITORIA.md).

- CSP sem scripts inline (`script-src 'self' https://challenges.cloudflare.com`), `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; HSTS em HTTPS; `nosniff`; Referrer-Policy;
  Permissions-Policy; COOP.
- CSRF: toda requisição que altera dados em `/admin` e `/api` precisa vir da própria origem + cookie `SameSite=Strict`
  - `security.checkOrigin` do Astro.
- Painel: autenticação no middleware **e** verificação repetida nos endpoints sensíveis; `no-store` e `noindex`.
- Uploads: validação de conteúdo real, limites de tamanho e dimensão, chaves geradas pelo servidor (UUID).
- Rate limit persistido no banco (funciona entre instâncias) com IP em hash salgado.

## Cache

| Recurso                                  | Cabeçalho / comportamento                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Páginas públicas (GET 200 HTML)          | `public, max-age=0, s-maxage=60, stale-while-revalidate=600`; na Cloudflare, **Cache API** guarda 60 s por data center (só em domínio próprio) |
| `/media/*`, `/og/*`, `/_astro/*`         | `public, max-age=31536000, immutable`; KV com `cacheTtl` de 1 dia na borda                                                                     |
| `sitemap.xml`, `robots.txt`              | 5 min no navegador, 1 h na CDN                                                                                                                 |
| Painel, APIs, respostas de erro/redirect | `private, no-store` (nunca entram no cache de borda)                                                                                           |

Configurações ficam em cache de memória por 30 s por instância. Resultado: alterações feitas no painel aparecem no
site em até ~1 minuto.

O cache de borda ignora cookies na chave (as páginas públicas são iguais para todos) e só guarda respostas marcadas
como página pública — sem `Set-Cookie`, nunca `/admin`, `/api`, `/media` ou `/og`.

## Latência

O D1 fica em uma única região (ENAM, costa leste dos EUA) e o Worker roda na borda mais próxima do visitante
(`Cf-Placement: local-GRU` para quem está no Brasil). Cada consulta ao D1 custa uma ida e volta (~140 ms a partir de
São Paulo), por isso as páginas disparam consultas independentes **em paralelo** (`Promise.all`): Home, estoque e página
do veículo precisam de 1–2 rodadas. Tempo até o primeiro byte medido no Brasil: ~220–300 ms (sem cache de borda) e
bem menos com o cache ativo no domínio próprio. O Smart Placement pode mover o Worker para perto do D1 se o tráfego
justificar; fixar a região nos EUA foi avaliado e descartado (as fotos passariam a vir de lá também).

## Portabilidade

- **Cloudflare ↔ Vercel ↔ Node:** trocar `DEPLOY_TARGET` e configurar banco/fotos da plataforma (ver
  [DEPLOY.md](DEPLOY.md) e [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)). Dados: `npm run cf:backup` gera `d1.sql` (SQLite) e
  as fotos com as mesmas chaves; `npm run db:backup`/`db:restore` fazem o mesmo no libSQL/Turso.
- **Fotos → qualquer object storage:** trocar `STORAGE_DRIVER` (`r2`, `kv`, `s3` compatível com R2/B2/S3/MinIO,
  `vercel-blob`) e copiar os arquivos (`cf:restore --media-only` ou `db:restore --with-media`).
- **Banco → PostgreSQL:** a interface `Database` isola o driver; os repositórios usam SQL simples. Ajustes: placeholders
  `$1`, `ON CONFLICT` equivalentes, `COLLATE NOCASE` → `ILIKE`/`citext`, booleanos nativos.
