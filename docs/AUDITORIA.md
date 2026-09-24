# Auditoria final

Data: **24/09/2026** · Ambiente verificado: produção na Cloudflare (`https://mm-veiculos.lupinho7881.workers.dev`),
build local em Node (testes E2E) e runtime local da Cloudflare (`wrangler dev`/workerd).

| Verificação                                                                   | Resultado                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                                                        | ✅ 0 problemas                                                                                                                                                                |
| Typecheck (`astro check`, TypeScript strictest)                               | ✅ 0 erros, 0 avisos                                                                                                                                                          |
| Prettier (`format:check`)                                                     | ✅                                                                                                                                                                            |
| Testes unitários + integração (Vitest)                                        | ✅ 140 passando (inclui adaptadores D1, KV e R2)                                                                                                                              |
| Testes E2E (Playwright, desktop + celular)                                    | ✅ 29 passando                                                                                                                                                                |
| Builds (`cloudflare`, `vercel`, `node`)                                       | ✅ os três compilam                                                                                                                                                           |
| `npm audit`                                                                   | ✅ 0 vulnerabilidades                                                                                                                                                         |
| Responsividade (320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440, 1920 px) | ✅ sem rolagem horizontal (teste E2E)                                                                                                                                         |
| Teste de fumaça na produção                                                   | ✅ login (senha errada/certa), criar veículo, enviar foto (4 versões no KV), publicar, página pública, imagem de compartilhamento, excluir (fotos removidas do storage), sair |
| Backup da produção (`cf:backup`)                                              | ✅ exportação do D1 + fotos                                                                                                                                                   |

## Lighthouse — produção na Cloudflare

Lighthouse 13.5 (mobile = Moto G Power com 4G simulado; desktop = preset desktop), medido do Brasil na URL publicada.

| Página                             | Mobile (Perf / Acess. / Boas práticas / SEO) | Desktop                |
| ---------------------------------- | -------------------------------------------- | ---------------------- |
| `/`                                | 99 / 100 / 100 / 69\*                        | 100 / 100 / 100 / 69\* |
| `/estoque`                         | 100 / 100 / 100 / 69\*                       | 100 / 100 / 100 / 69\* |
| `/veiculo/...` (3 fotos realistas) | 97–98 / 100 / 100 / 69\*                     | 100 / 100 / 100 / 69\* |
| `/anuncie-seu-veiculo`             | 99 / 100 / 100 / 69\*                        | 100 / 100 / 100 / 69\* |
| `/ofertas`                         | 100 / 100 / 100 / 69\*                       | 100 / 100 / 100 / 69\* |

CLS = 0 e TBT = 0 ms em todas. Observações:

- \* SEO 69 **de propósito**: com `ALLOW_INDEXING=false` (até existir o domínio) todas as páginas enviam `noindex`. No
  build local com indexação liberada o SEO é 100.
- Home, estoque e ofertas foram medidos com o estoque vazio (produção ainda sem veículos reais). A página do veículo
  foi medida com um veículo temporário (fotos com peso realista: grande ~400 KB, média ~200 KB), excluído em seguida.
- Página do veículo no celular: era **91 (LCP 3,5 s)** porque o celular baixava a foto grande (1920 px). Com a versão
  **média (1080 px)** e as fotos seguintes da galeria carregando só depois da página, ficou **97–98 (LCP 2,5 s)**.

## Segurança

| Item              | Situação                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SQL injection     | Todas as consultas parametrizadas; ORDER BY vem de lista fechada; `LIKE` com escape                                                                                                                                                              |
| XSS               | Astro escapa toda saída; `set:html` só em ícones estáticos e JSON-LD (com escape de `<`, `>` e `&`); scripts de navegador usam `textContent` para dados                                                                                          |
| CSP               | `script-src 'self' https://challenges.cloudflare.com` (sem scripts inline — verificado por teste E2E de violações), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` em HTTPS |
| Headers           | HSTS (produção HTTPS), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `COOP`, `X-Robots-Tag` — conferidos na produção, inclusive em respostas vindas do cache de borda                                    |
| CSRF              | Verificação de origem no middleware para qualquer POST/PUT/DELETE em `/admin` e `/api`, `security.checkOrigin` do Astro e cookie `SameSite=Strict` (teste E2E cobre)                                                                             |
| Autenticação      | PBKDF2-SHA256 (50 mil iterações no Workers, 600 mil em Node), comparação em tempo constante, sessão HMAC com expiração, rate limit de login, nenhuma senha no código ou no Git; Cloudflare Access com validação de JWT disponível                |
| Autorização       | Middleware exige sessão em `/admin/*` e `/api/admin/*`; endpoints sensíveis verificam de novo (`locals.admin`)                                                                                                                                   |
| Redirecionamentos | `next`/`returnTo` aceitam apenas caminhos internos do painel (sem open redirect)                                                                                                                                                                 |
| Uploads           | Assinatura real do arquivo, limite de bytes, dimensões e proporção entre as versões; chaves geradas no servidor; PNG/SVG/HTML recusados; storage privado                                                                                         |
| Cache de borda    | Só páginas públicas GET 200 sem `Set-Cookie`; nunca `/admin`, `/api`, `/media`, `/og`; chave sem cookies (páginas iguais para todos) — teste unitário + verificação no workerd                                                                   |
| Dados pessoais    | IP só em hash salgado; fotos de propostas só por rota autenticada `no-store`; exclusão definitiva (LGPD) no painel; política de privacidade publicada                                                                                            |
| Anti-spam         | Turnstile validado no servidor (chave real na produção), honeypot, rate limit 5/h e 15/dia por IP, limite de 4,3 MB por envio; sem chaves o formulário é bloqueado (falha segura)                                                                |
| Segredos          | Secrets do Worker (`wrangler secret`) e `.env` local ignorado pelo Git; nada exposto ao navegador; o arquivo `.dev.vars` gerado pelo build é apagado antes do deploy                                                                             |
| Dependências      | `path-to-regexp` (via adapter Vercel) forçado para 6.3.0 com `overrides` — corrige GHSA-9wv6-86v2-598j                                                                                                                                           |

**Problemas encontrados e corrigidos**

Fase 1 (site e painel):

1. Respostas antecipadas do middleware (redirect para o login, 401, 403) saíam sem headers de segurança e sem
   `no-store` → toda resposta passa pelo mesmo tratamento (teste E2E).
2. Telefone internacional com `+1` era aceito como brasileiro → corrigido (teste unitário).
3. `upgrade-insecure-requests` quebraria o preview local em HTTP → aplicado só em HTTPS.
4. Vulnerabilidade de dependência transitiva (ver acima) → corrigida.

Fase 2 (Cloudflare):

5. No Workers, `new Date()` no escopo do módulo retorna 1970 → a validação do ano máximo do veículo recusava tudo
   (“no máximo 1970”) na produção. O limite agora é calculado na hora da validação (teste de regressão).
6. PBKDF2 com 600 mil iterações não é aceito pelo Workers (limite de 100 mil e 10 ms de CPU) → 50 mil no Workers,
   com hash marcado no próprio formato (`pbkdf2-sha256$50000$...`).
7. Workers não roda `sharp` → a imagem de compartilhamento (1200×630 com a logo) passou a ser gerada no navegador,
   no upload.
8. O bundle do Worker puxava `node:fs` e `@vercel/blob` pelo índice do storage → imports diretos por módulo.
9. O build gera `dist/server/.dev.vars` com valores do `.env` local → removido antes de todo deploy.
10. Mobile LCP da página do veículo (ver Lighthouse) → versão média + galeria sem disputa de banda.
11. Consultas sequenciais ao D1 (cada uma ~140 ms a partir do Brasil) → consultas em paralelo; estoque caiu de
    ~400 ms para ~250 ms até o primeiro byte.
12. A CDN não guarda respostas do Worker → cache de borda próprio (Cache API) para páginas públicas, 60 s.
13. Cota do KV gratuito (1.000 gravações/dia) gerava erro genérico → mensagem clara no painel; no formulário público a
    proposta é salva sem as fotos, com anotação para pedi-las pelo WhatsApp (testes).
14. `cf:backup` quebrou com o limite de termos de `UNION` do D1; `cf:restore` rodaria `CREATE TABLE` sobre o banco em
    uso → consultas separadas, modo `--media-only` e restauração documentada em banco novo (ou Time Travel).

**Riscos aceitos / limitações conhecidas**

- Sessões do painel são _stateless_: para derrubar todas antes de 12 h, troque `SESSION_SECRET` ou a senha.
- Mensagens de aviso do painel (`?ok=`/`?erro=`) vêm da URL (texto escapado); um link malicioso poderia exibir um
  texto falso para um administrador logado — sem execução de código. Risco baixo.
- Senha única compartilhada no modo `password`; para usuários individuais, usar o modo Cloudflare Access.
- Com o cache de borda (domínio próprio), uma alteração no painel pode levar até ~1 minuto para aparecer no site.
- Excluir veículo é _soft delete_ no banco (registro invisível, histórico preservado); as fotos são apagadas do storage.

## Performance

- Islands: JavaScript só nas páginas que precisam, sem framework no cliente; CSS/JS servidos como arquivos estáticos
  da Cloudflare (grátis, sem passar pelo Worker), com cache imutável.
- Fonte variável única (Archivo) com preload; `font-display: swap`.
- Fotos em WebP em 3 larguras (720/1080/1920) com `srcset`/`sizes`; preload + `fetchpriority="high"` da capa; demais
  fotos da galeria carregam depois; dimensões explícitas (CLS 0).
- Páginas: consultas ao D1 em paralelo, configurações em cache de 30 s na instância, cache de borda de 60 s no domínio
  próprio; fotos com cache de 1 ano no navegador e 1 dia na borda do KV.

## SEO

- `title`, `description`, canonical, Open Graph/Twitter em todas as páginas; imagem OG por veículo (JPEG 1200×630
  com a marca) para WhatsApp/Facebook.
- JSON-LD: `AutoDealer` (empresa, apenas dados reais), `Car`/`Motorcycle`/`Vehicle` + `Product` + `Offer`
  (disponibilidade: InStock / LimitedAvailability / SoldOut) e `BreadcrumbList`.
- `sitemap.xml` dinâmico (sem rascunhos/arquivados), `robots.txt` que bloqueia tudo até `ALLOW_INDEXING=true`.
- Páginas filtradas do estoque com `noindex` (evita conteúdo duplicado); canonical para a listagem principal.

## Acessibilidade

HTML semântico, “Pular para o conteúdo”, foco visível dourado, rótulos em todos os campos, mensagens de erro ligadas
aos campos, `aria-live` em contadores/resultados, `dialog` nativo nos menus e na tela cheia da galeria (Esc e foco),
navegação da galeria por teclado, alvos de toque ≥ 44 px, contraste adequado no tema escuro, `prefers-reduced-motion`
respeitado. Lighthouse Acessibilidade: 100 em todas as páginas medidas.

## UX / Mobile

Barra inferior estilo aplicativo (Início, Estoque, **Anunciar**, Favoritos, WhatsApp), menu em tela cheia, filtros em
gaveta, galeria com swipe nativo, barra fixa “Tenho interesse” na página do veículo, formulários com teclado numérico e
máscaras de telefone/valores, fotos otimizadas no próprio celular antes do envio.

## Banco, storage e escalabilidade

- Índices para listagem pública, marca/modelo, categoria, preço, flags e datas.
- Contagens e facetas em SQL; paginação com `LIMIT/OFFSET` (adequado para o porte do estoque).
- Rate limit e configurações persistidos no banco (funciona com várias instâncias).
- Storage e banco atrás de interfaces — troca de provedor sem mexer em regras de negócio.
- Capacidade no plano gratuito: ver [DEPLOY.md → Limites](DEPLOY.md#10-limites-do-plano-gratuito-e-monitoramento).
  Ponto de atenção: 1.000 gravações/dia no KV (~250 fotos de veículo/dia) até o R2 ser ativado.

## Dados não inventados

Nenhum dado fictício é exibido: sem avaliações, números de vendas, tempo de mercado, CNPJ, endereço ou horário (só
aparecem se cadastrados). Sem cronômetros, “últimas unidades” ou descontos não calculados. A produção está com o
estoque vazio (“Novos veículos em breve”) até a M&M cadastrar os veículos reais; o seed de demonstração só roda no
banco local.
