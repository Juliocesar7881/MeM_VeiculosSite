# Auditoria final

Data: **24/09/2026** · Versão: 1.0.0 · Ambiente verificado: build de produção local (adapter Node, `npm run
preview:local`) e servidor de desenvolvimento com banco de demonstração.

Resumo da verificação automatizada:

| Verificação | Resultado |
| --- | --- |
| ESLint | ✅ 0 problemas |
| Typecheck (`astro check`, TypeScript strictest) | ✅ 0 erros, 0 avisos |
| Testes unitários + integração (Vitest) | ✅ 128 passando |
| Testes E2E (Playwright, desktop + celular) | ✅ 29 passando |
| Build de produção (adapter Vercel) | ✅ |
| `npm audit` | ✅ 0 vulnerabilidades |
| Responsividade (320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440, 1920 px) | ✅ sem rolagem horizontal em 9 páginas |

## Lighthouse (build de produção local, `ALLOW_INDEXING=true`)

| Página | Mobile (Perf / Acess. / Boas práticas / SEO) | Desktop |
| --- | --- | --- |
| `/` | 94 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/estoque` | 93 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/veiculo/...` | 91 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/anuncie-seu-veiculo` | 97 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/ofertas` | 96 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |

CLS = 0 e TBT = 0 ms em todas. Observações honestas:

- A medição mobile simula 4G lento num servidor local **sem compressão** (o Lighthouse aponta ~30 KB economizáveis
  por página). Na Vercel o HTML/CSS é servido com Brotli pela CDN, o que tende a melhorar FCP/LCP — **meça novamente
  na URL publicada** (PageSpeed Insights).
- Na página do veículo o LCP é a foto principal (~1920 px). Existem 2 versões por foto (grande e miniatura de 720 px),
  como pedido; uma versão intermediária (~1080 px) reduziria o LCP no celular, ao custo de +1 upload por foto no
  plano gratuito do Blob. Decisão registrada para reavaliar com fotos reais.
- Com `ALLOW_INDEXING=false` (padrão até existir o domínio) o SEO do Lighthouse cai para 69 **de propósito**
  (“página bloqueada para indexação”).
- Imagens de demonstração são ilustrações leves; fotos reais serão maiores (o limite no upload é 1,2 MB por foto
  grande, normalmente 200–400 KB em WebP).

## Segurança

| Item | Situação |
| --- | --- |
| SQL injection | Todas as consultas parametrizadas; ORDER BY vem de lista fechada; `LIKE` com escape |
| XSS | Astro escapa toda saída; `set:html` só em ícones estáticos e JSON-LD (com escape de `<`, `>` e `&`); scripts de navegador usam `textContent` para dados |
| CSP | `script-src 'self' https://challenges.cloudflare.com` (sem scripts inline — verificado no build e por teste E2E de violações), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` em HTTPS |
| Headers | HSTS (HTTPS), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `COOP`, `X-Robots-Tag` no painel/APIs |
| CSRF | Verificação de origem no middleware para qualquer POST/PUT/DELETE em `/admin` e `/api`, `security.checkOrigin` do Astro e cookie `SameSite=Strict` (teste E2E cobre) |
| Autenticação | PBKDF2-SHA256 600k, comparação em tempo constante, sessão HMAC com expiração, rate limit de login, nenhuma senha no código; Cloudflare Access com validação de JWT disponível |
| Autorização | Middleware exige sessão em `/admin/*` e `/api/admin/*`; endpoints sensíveis verificam de novo (`locals.admin`) |
| Redirecionamentos | `next`/`returnTo` aceitam apenas caminhos internos do painel (sem open redirect) |
| Uploads | Assinatura real do arquivo, limite de bytes, dimensões e proporção; chaves geradas no servidor; PNG/SVG/HTML recusados; storage privado |
| Dados pessoais | IP só em hash salgado; fotos de propostas só por rota autenticada `no-store`; exclusão definitiva (LGPD) no painel; política de privacidade publicada |
| Anti-spam | Turnstile validado no servidor, honeypot, rate limit 5/h e 15/dia por IP, limite de 4,3 MB por envio; em produção sem chaves o formulário é bloqueado (falha segura) |
| Segredos | Somente via variáveis de ambiente; `.env*` no `.gitignore`; nada exposto ao navegador |
| Dependências | `path-to-regexp` (via adapter Vercel) forçado para 6.3.0 com `overrides` — corrige GHSA-9wv6-86v2-598j |

**Problemas encontrados e corrigidos durante a auditoria**

1. Respostas antecipadas do middleware (redirect para o login, 401, 403) saíam **sem headers de segurança e sem
   `no-store`** → corrigido: toda resposta passa pelo mesmo tratamento (teste E2E adicionado).
2. Telefone internacional com `+1` era aceito como brasileiro → corrigido (teste unitário).
3. `upgrade-insecure-requests` quebraria o preview local em HTTP → aplicado só em HTTPS.
4. Vulnerabilidade de dependência transitiva (ver acima) → corrigida.

**Riscos aceitos / limitações conhecidas**

- Sessões do painel são *stateless*: para derrubar todas antes de 12 h, troque `SESSION_SECRET` ou a senha.
- Mensagens de aviso do painel (`?ok=`/`?erro=`) vêm da URL (texto escapado); um link malicioso poderia exibir um
  texto falso para um administrador logado — sem execução de código. Risco baixo.
- Senha única compartilhada no modo `password`; para múltiplos usuários com identidade individual, usar o modo
  Cloudflare Access (planejado).

## Performance

- Islands: ~24 KB de JavaScript no site inteiro, carregado só nas páginas que precisam; sem framework no cliente.
- CSS global em arquivo com cache imutável; CSS pequeno de componentes embutido na página.
- Fonte variável única (Archivo, largura + peso) com preload; `font-display: swap`.
- Fotos em WebP nos tamanhos certos, `srcset`/`sizes`, `loading="lazy"` fora da dobra, `fetchpriority="high"` e
  preload da imagem LCP na página do veículo; dimensões explícitas (CLS 0).
- CDN: HTML 60 s + stale-while-revalidate, fotos 1 ano, configurações em cache de 30 s na instância.

## SEO

- `title`, `description`, canonical, Open Graph/Twitter em todas as páginas; imagem OG por veículo (JPEG 1200×630
  com a marca) para WhatsApp/Facebook.
- JSON-LD: `AutoDealer` (empresa, apenas dados reais), `Car`/`Motorcycle`/`Vehicle` + `Product` + `Offer`
  (disponibilidade: InStock / LimitedAvailability / SoldOut) e `BreadcrumbList`.
- `sitemap.xml` dinâmico (sem rascunhos/arquivados), `robots.txt` que bloqueia tudo até `ALLOW_INDEXING=true`.
- Páginas filtradas do estoque com `noindex` (evita conteúdo duplicado); canonical para a listagem principal.
- Títulos pedidos: “Ofertas de veículos | M&M Veículos”, “Veículos de repasse em Massaranduba | M&M Veículos”,
  “Venda seu veículo em Massaranduba | M&M Veículos”.

## Acessibilidade

HTML semântico, “Pular para o conteúdo”, foco visível dourado, rótulos em todos os campos, mensagens de erro ligadas
aos campos, `aria-live` em contadores/resultados, `dialog` nativo nos menus e na tela cheia da galeria (Esc e foco),
navegação da galeria por teclado, alvos de toque ≥ 44 px, contraste adequado no tema escuro, `prefers-reduced-motion`
respeitado. Lighthouse Acessibilidade: 100 nas páginas medidas.

## UX / Mobile

Barra inferior estilo aplicativo (Início, Estoque, **Anunciar**, Favoritos, WhatsApp), menu em tela cheia, filtros em
gaveta, galeria com swipe nativo, barra fixa “Tenho interesse” na página do veículo, formulários com teclado numérico e
máscaras de telefone/valores, fotos otimizadas no próprio celular antes do envio.

## Banco, storage e escalabilidade

- Índices para listagem pública, marca/modelo, categoria, preço, flags e datas.
- Contagens e facetas em SQL; paginação com `LIMIT/OFFSET` (adequado para o porte do estoque).
- Rate limit e configurações persistidos no banco (funciona com várias instâncias serverless).
- Storage e banco atrás de interfaces — troca de provedor sem mexer em regras de negócio.

## Custos

Ver [README → Custos e planos gratuitos](../README.md#custos-e-planos-gratuitos). Ponto de atenção: **o plano Hobby da
Vercel é não comercial**; para produção comercial, Vercel Pro ou migração para Cloudflare.

## Dados não inventados

Nenhum dado fictício é exibido em produção: sem avaliações, números de vendas, tempo de mercado, CNPJ, endereço ou
horário (só aparecem se cadastrados). Sem cronômetros, “últimas unidades” ou descontos não calculados. O seed de
demonstração só roda no banco local e marca tudo como demonstração.
