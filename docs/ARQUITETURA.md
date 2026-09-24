# Arquitetura

## Visão geral

```
┌──────────────┐    ┌──────────────────── Cloudflare (produção) ────────────────────┐
│  Navegador   │───►│ Borda: arquivos estáticos /_astro (imutáveis) · Turnstile     │
│ (JS mínimo)  │    │   │                                                           │
└──────────────┘    │   ▼                                                           │
                    │ Worker (Astro SSR, @astrojs/cloudflare)                       │
                    │   middleware.ts ─ CSRF · auth /admin · headers · cache        │
                    │   pages/ ─ apresentação (sem SQL)                             │
                    │   services/ ─ regras de negócio                               │
                    │   repositories/ ─ SQL parametrizado   lib/storage/ ─ fotos    │
                    └──────────┬──────────────────────────────────────┬─────────────┘
                               ▼                                      ▼
                         D1 (SQLite)                        Workers KV  |  R2

Alternativa (mesmo código): Vercel/Node → libSQL (arquivo local ou Turso) + local | Vercel Blob | S3
```

O módulo `@/server/platform` é trocado no build (`astro.config.mjs`, alias por `DEPLOY_TARGET`):
`platform/cloudflare.ts` usa os bindings `DB`, `MEDIA_KV`/`MEDIA` e nunca carrega libSQL, `sharp` ou `fs`;
`platform/node.ts` usa libSQL e os drivers de storage do Node.

Princípios aplicados:

- **UI não executa SQL.** Páginas e endpoints chamam serviços; serviços usam repositórios; só repositórios conhecem SQL.
- **Toda consulta é parametrizada** (`?`), inclusive buscas (`LIKE ? ESCAPE '\'`).
- **Validação no servidor com Zod** em toda entrada (formulários, filtros de URL, JSON do admin).
- **Nenhum segredo no cliente.** Variáveis lidas em tempo de execução via `astro:env/server`.
- **Injeção de dependências manual** (`src/server/services.ts`): o mesmo código roda no site, nos scripts e nos testes.
- **JavaScript só onde há interação** (Islands): header, galeria, filtros, favoritos, formulário, fotos do admin.
  Todo o resto é HTML renderizado no servidor; filtros e formulários do admin funcionam mesmo sem JavaScript.

## Camadas e pastas

| Pasta | Responsabilidade |
| --- | --- |
| `src/pages` | Rotas. Páginas `.astro` (site e painel) e endpoints `.ts` (`/api/*`, `/media/*`, `/og/*`, `sitemap.xml`, `robots.txt`) |
| `src/middleware.ts` | Container de dependências por requisição, proteção CSRF por origem, autenticação do painel, headers de segurança e cache |
| `src/services` | `VehicleService`, `MediaService`, `LeadService` (inclui conversão proposta→veículo), `SettingsService` (cache 30 s), `RateLimiter`, `AuditService`, notificação opcional por e-mail |
| `src/repositories` | SQL de cada agregado + mapeamento linha → domínio |
| `src/schemas` | Zod (veículo, proposta, configurações) e parser tolerante dos filtros de URL |
| `src/lib/db` | Interface `Database` + implementações libSQL e **D1** + migrador compatível com D1 |
| `src/lib/storage` | Interface `ObjectStorage` + drivers `kv`, `r2`, `local`, `vercel-blob`, `s3` + convenção de chaves |
| `src/server/platform` | Escolha de banco/storage por runtime (Workers × Node) |
| `src/lib/auth` | PBKDF2, sessão HMAC, validação do Cloudflare Access (JWT) |
| `src/features` | Scripts de navegador (TypeScript, sem framework) |
| `src/components` | Componentes Astro (design system, cards, galeria, formulários, painel) |

## Modelo de dados

```
vehicles ─┬─< vehicle_images        (fotos: large_key, thumb_key, dimensões, position — posição 0 = capa)
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
- Excluir veículo = `deleted_at` + remoção das fotos do storage (histórico preservado).
- Proposta nunca é publicada; a conversão cria **rascunho** sem preço e **copia** as fotos para `vehicles/`.

## Fotos

1. Navegador: `createImageBitmap(..., { imageOrientation: 'from-image' })` → canvas → WebP (JPEG se o navegador não
   codificar WebP), reduzindo qualidade/dimensão até caber no limite. Metadados EXIF/GPS são descartados.
2. Envio: veículos = 1 requisição por foto (grande + miniatura); propostas = até 6 pares no mesmo envio (< 4,3 MB,
   abaixo do limite de 4,5 MB da Vercel).
3. Servidor: `inspectImage` confere assinatura real (WebP/JPEG), bytes, dimensões e proporção grande×miniatura.
4. Armazenamento privado; entrega por `/media/*` (somente chaves `vehicles/<uuid>/<uuid>(-thumb).(webp|jpg)`), com
   `Cache-Control: immutable` de 1 ano. Fotos de propostas só por rota autenticada, `no-store`.
5. Open Graph: `/og/veiculo/<id>/<fotoId>.jpg` gera JPEG 1200×630 com a marca (sharp), cacheado de forma imutável.

## Segurança (resumo)

Detalhes e resultado da verificação em [AUDITORIA.md](AUDITORIA.md).

- CSP sem scripts inline (`script-src 'self' https://challenges.cloudflare.com`), `frame-ancestors 'none'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; HSTS em HTTPS; `nosniff`; Referrer-Policy;
  Permissions-Policy; COOP.
- CSRF: toda requisição que altera dados em `/admin` e `/api` precisa vir da própria origem + cookie `SameSite=Strict`
  + `security.checkOrigin` do Astro.
- Painel: autenticação no middleware **e** verificação repetida nos endpoints sensíveis; `no-store` e `noindex`.
- Uploads: validação de conteúdo real, limites de tamanho e dimensão, chaves geradas pelo servidor (UUID).
- Rate limit persistido (funciona entre instâncias serverless) com IP em hash salgado.

## Cache

| Recurso | Cabeçalho |
| --- | --- |
| Páginas públicas (GET 200 HTML) | `public, max-age=0, s-maxage=60, stale-while-revalidate=600` |
| `/media/*`, `/og/*`, `/_astro/*` | `public, max-age=31536000, immutable` |
| `sitemap.xml`, `robots.txt` | 5 min no navegador, 1 h na CDN |
| Painel, APIs, respostas de erro/redirect | `private, no-store` |

Configurações ficam em cache de memória por 30 s por instância. Resultado: alterações aparecem em até ~1 minuto.

No **Cloudflare Workers** o `s-maxage` não coloca o HTML em cache automaticamente: cada página é gerada pelo Worker
(consultas ao D1 na mesma região, graças ao *Smart Placement*). As fotos (`/media/*`) são lidas do KV com cache na
borda (`cacheTtl` de 1 dia — as chaves nunca mudam de conteúdo) e ficam 1 ano no cache do navegador.

## Portabilidade

### Banco: D1 ⇄ libSQL/Turso

- Migrations em SQLite puro, controladas pela tabela `d1_migrations` (formato do Wrangler) — as mesmas no D1
  (`npm run cf:migrate`) e no libSQL (`npm run db:migrate`).
- `src/lib/db/d1.ts` e `src/lib/db/libsql.ts` implementam a mesma interface `Database`; nenhum repositório muda.
- Dados entre plataformas: `npm run db:backup` gera `database.sql`; `npm run cf:backup` gera `d1.sql`.

### Banco: → PostgreSQL

- A interface `Database` isola o driver; os repositórios usam SQL simples. Ajustes necessários: placeholders `$1`,
  `INSERT OR REPLACE`/`ON CONFLICT` equivalentes, `COLLATE NOCASE` → `ILIKE`/`citext`, booleanos nativos.

### Fotos

- Cloudflare: `STORAGE_DRIVER=kv` (padrão, grátis sem cartão) ou `r2`. Node/Vercel: `local`, `vercel-blob` ou `s3`
  (R2, B2, S3, MinIO).
- No Workers não há `sharp`: a imagem de compartilhamento (Open Graph, JPEG 1200×630) é gerada **no navegador** durante
  o upload e validada no servidor; no Node ela é gerada com `sharp`.

## Cloudflare (produção)

Passo a passo em [DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md). Resumo das decisões:

1. **Hospedagem:** Workers com `@astrojs/cloudflare`; CPU gratuita de 10 ms por requisição é suficiente (HTML simples +
   poucas consultas). PBKDF2 do login usa 50 mil iterações (limite do WebCrypto do Workers), compensado pelo rate limit.
2. **Banco:** D1 (binding `DB`), migrations aplicadas a cada deploy (`npm run cf:deploy` / GitHub Actions).
3. **Fotos:** Workers KV (binding `MEDIA_KV`) com leitura cacheada na borda; R2 quando o volume crescer.
4. **Segredos:** `npm run cf:secrets` (senha do painel, sessão, sal do IP, Turnstile, Resend).
5. **Admin:** senha + sessão, ou Cloudflare Access (`AUTH_MODE=cloudflare-access`, o backend valida o JWT).
6. **IP do cliente** (rate limit): somente `CF-Connecting-IP`, definido pela Cloudflare.
7. **DNS/domínio:** Cloudflare DNS + Custom Domain no Worker; `PUBLIC_SITE_URL` e `ALLOW_INDEXING=true`.
