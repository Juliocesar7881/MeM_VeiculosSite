# Auditoria final

Data: **24/09/2026** · Ambiente verificado: produção na Cloudflare (`https://mm-veiculos.lupinho7881.workers.dev`),
build local em Node (testes E2E) e runtime local da Cloudflare (`wrangler dev`/workerd).

| Verificação                                                                   | Resultado                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                                                        | ✅ 0 problemas                                                                                                                                                                |
| Typecheck (`astro check`, TypeScript strictest)                               | ✅ 0 erros, 0 avisos                                                                                                                                                          |
| Prettier (`format:check`)                                                     | ✅                                                                                                                                                                            |
| Testes unitários + integração (Vitest)                                        | ✅ 176 passando (inclui adaptadores D1, KV e R2, métricas e redirecionamento)                                                                                                 |
| Testes E2E (Playwright, desktop + celular)                                    | ✅ 35 passando                                                                                                                                                                |
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

| Item              | Situação                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SQL injection     | Todas as consultas parametrizadas; ORDER BY vem de lista fechada; `LIKE` com escape                                                                                                                                                                                                                                                                                                                           |
| XSS               | Astro escapa toda saída; `set:html` só em ícones estáticos e JSON-LD (com escape de `<`, `>` e `&`); scripts de navegador usam `textContent` para dados                                                                                                                                                                                                                                                       |
| CSP               | `script-src 'self' https://challenges.cloudflare.com` (sem scripts inline — verificado por teste E2E de violações), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests` em HTTPS                                                                                                                                                              |
| Headers           | HSTS (produção HTTPS), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `COOP`, `X-Robots-Tag` — conferidos na produção, inclusive em respostas vindas do cache de borda                                                                                                                                                                                                 |
| CSRF              | Verificação de origem no middleware para qualquer POST/PUT/DELETE em `/admin` e `/api`, `security.checkOrigin` do Astro e cookie `SameSite=Strict` (teste E2E cobre)                                                                                                                                                                                                                                          |
| Autenticação      | PBKDF2-SHA256 (50 mil iterações no Workers, 600 mil em Node), comparação em tempo constante, sessão HMAC com expiração, login bloqueado por 30 min após 5 senhas erradas seguidas (por IP), teto de 30/dia por IP e de 100 somando todos os IPs, bloqueio seguro se o banco falhar, "Sair" encerra a sessão no servidor, nenhuma senha no código ou no Git; Cloudflare Access com validação de JWT disponível |
| Autorização       | Middleware exige sessão em `/admin/*` e `/api/admin/*`; endpoints sensíveis verificam de novo (`locals.admin`)                                                                                                                                                                                                                                                                                                |
| Redirecionamentos | `next`/`returnTo` aceitam apenas caminhos internos do painel (sem open redirect)                                                                                                                                                                                                                                                                                                                              |
| Uploads           | Assinatura real do arquivo, limite de bytes, dimensões e proporção entre as versões; chaves geradas no servidor; PNG/SVG/HTML recusados; storage privado                                                                                                                                                                                                                                                      |
| Cache de borda    | Só páginas públicas GET 200 sem `Set-Cookie`; nunca `/admin`, `/api`, `/media`, `/og`; chave sem cookies (páginas iguais para todos) — teste unitário + verificação no workerd                                                                                                                                                                                                                                |
| Métricas          | `/api/metrics` só aceita a própria origem (403 para outros sites), corpo ≤ 512 bytes, resposta sempre 204, 1 contagem por visitante/veículo/evento a cada 30 min e no máximo 300 gravações/min por instância; só veículos publicados; nenhum dado do visitante gravado                                                                                                                                        |
| Endereço oficial  | 301 para o domínio de `PUBLIC_SITE_URL` (sem open redirect: destino fixo na configuração) — teste unitário                                                                                                                                                                                                                                                                                                    |
| Dados pessoais    | IP só em hash salgado; fotos de propostas só por rota autenticada `no-store`; exclusão definitiva (LGPD) no painel; política de privacidade publicada                                                                                                                                                                                                                                                         |
| Anti-spam         | Turnstile validado no servidor (chave real na produção, conferindo o domínio), honeypot, rate limit 5/h e 15/dia por IP (IP só do cabeçalho da própria plataforma), tamanho do envio obrigatório e até 4,3 MB; sem chaves o formulário é bloqueado (falha segura)                                                                                                                                             |
| Segredos          | Secrets do Worker (`wrangler secret`) e `.env` local ignorado pelo Git; nada exposto ao navegador; o arquivo `.dev.vars` gerado pelo build é apagado antes do deploy                                                                                                                                                                                                                                          |
| Dependências      | `path-to-regexp` (via adapter Vercel) forçado para 6.3.0 com `overrides` — corrige GHSA-9wv6-86v2-598j                                                                                                                                                                                                                                                                                                        |

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

Fase 3 (conta dedicada, senha, domínio, métricas):

15. A conta Cloudflare anterior dividia a cota diária gratuita com outro projeto (37% das leituras do D1) → site
    recriado numa conta dedicada; senha de desenvolvimento trocada por senha forte aleatória.
16. **Incidente (24/09/2026, ~2 min):** durante a edição da documentação, um comando foi disparado por engano e
    publicou uma versão apontando para um domínio ainda inexistente; todas as páginas redirecionaram para ele até a
    versão correta ser republicada. Nenhum dado foi afetado. Correções: o `cf:domain` agora confere no DNS que o
    domínio já está na Cloudflare antes de alterar qualquer coisa e, se a publicação falhar, republica a versão
    anterior e restaura o Turnstile; o redirecionamento de domínio fica em cache por só 5 min.

Fase 4 (auditoria de segurança completa, 25/09/2026):

17. **IP forjável fora da Cloudflare:** em Vercel/Node o `CF-Connecting-IP`/`X-Forwarded-For` enviado pelo próprio
    visitante era aceito; trocando o IP a cada tentativa dava para burlar o limite do login e do formulário. Agora
    só vale o que a plataforma escreve (Cloudflare: `CF-Connecting-IP`; Vercel: `X-Real-IP`; Node: endereço da
    conexão). Testes unitários + ataque simulado (bloqueio na 7ª tentativa mesmo trocando o IP).
18. **Esgotamento da cota do D1 (100 mil gravações/dia):** cada tentativa já bloqueada ainda gravava no banco e
    `/api/metrics` gravava a cada requisição, sem limite. Agora o bloqueio fica em memória (recusa sem gravar) e as
    métricas contam 1 vez por visitante/veículo/evento a cada 30 min, com teto de 300 gravações/min por instância.
19. **Corpo sem tamanho declarado** era lido sem limite no formulário de propostas, nas métricas e no upload do
    painel → tamanho obrigatório (411) ou ignorado (métricas). Navegadores sempre enviam o tamanho.
20. **Login:** teto diário de 30 tentativas por IP (além de 6 a cada 15 min) e bloqueio seguro se o banco falhar
    (antes liberava a tentativa sem contar).
21. **"Sair" apagava só o cookie:** uma cópia do cookie continuava valendo até 12 h. Agora o servidor grava um corte
    (`auth_sessions_valid_after` em `site_settings`) e recusa toda sessão emitida antes do último "Sair" — teste de
    integração + verificação no servidor com cookie copiado.
22. **Turnstile:** o servidor confere que o desafio foi resolvido no próprio domínio (`hostname`).
23. **Arquivos estáticos** (JS, CSS, fontes, imagens), servidos direto pela Cloudflare, ganham `nosniff`,
    `Referrer-Policy` e `X-Frame-Options` via `public/_headers`.
24. **Avisos falsos no painel:** `?ok=`/`?erro=` eram exibidos como vinham na URL; um link malicioso podia mostrar a
    um administrador logado um texto falso ("Veículo excluído", "Ligue para..."). Agora o aviso é assinado pelo
    servidor (HMAC, `&fs=`) e o painel ignora o que não tiver assinatura válida (`src/server/flash.ts`, testes).
25. **Fotos de rascunhos** (inclusive as de clientes, vindas de propostas) abriam para quem tivesse o link. Agora
    `/media` só serve a qualquer visitante as fotos de veículos publicados; as demais exigem login no painel e saem
    com `no-store` (teste de integração + verificação no servidor: 404 sem login, 200 com login).
26. **Cloudflare Access:** fora de `/admin` (ex.: fotos de rascunho carregadas pelo painel) o JWT é lido também do
    cookie `CF_Authorization`, validado da mesma forma (issuer + audience).
27. **`/.well-known/security.txt`** (RFC 9116) com o contato para avisos de falhas de segurança.
28. **Bloqueio do login (25/09/2026):** 5 senhas erradas seguidas bloqueiam o IP por 30 minutos — bloqueado, nem a
    senha certa entra e a senha nem é conferida. A tentativa é contada antes da conferência, então requisições em
    paralelo não passam de 5 conferências. Contra ataques distribuídos (muitos IPs, poucas tentativas cada), 100
    tentativas seguidas somando todos os IPs pausam o login por 30 minutos (quem já está logado segue usando o
    painel). A tela avisa quantas tentativas restam. Testes em `tests/integration/login-lockout.test.ts`.

Fase 5 (teste de invasão no runtime da Cloudflare — `wrangler dev`/workerd com D1 e KV locais — 25/09/2026):

140 ataques automatizados, repetidos depois das correções. Correções:

29. **Busca longa derrubava a página (500):** o D1 recusa padrões de `LIKE` acima de 50 bytes ("LIKE or GLOB
    pattern too complex"); uma palavra de 49+ letras na busca do site, do painel ou das propostas gerava erro 500 (o
    SQLite local não tem esse limite, por isso os testes não pegavam). Agora cada termo é cortado para caber
    (`likeContains`, testes em `tests/unit/text.test.ts`).
30. **Formulário malformado (500):** corpo `multipart` quebrado em `/api/leads`, no upload de fotos e nos formulários
    do painel gerava erro 500. Agora vira mensagem de "envio inválido" (422) ou formulário vazio com os erros.
31. **"Sair" no mesmo segundo:** o corte de sessões era em segundos inteiros; uma sessão criada no mesmo segundo do
    "Sair" continuava valendo. Agora emissão e corte usam milissegundos (teste de integração).

Resultado dos ataques (todos bloqueados): sessão forjada (payload alterado, assinatura trocada, cookie vazio/gigante,
"alg none"); CSRF (Origin de outro site, `null`, subdomínio parecido, sem Origin); redirecionamento aberto em `next` e
`returnTo` (8 variações); todas as rotas do painel e da API sem login (15 rotas × métodos); fotos e imagem de
compartilhamento de rascunhos; rascunho via busca, favoritos forjados e sitemap; apagar/reordenar foto de outro
veículo; path traversal em `/media` e `/api/admin/lead-media`; XSS armazenado (campos do veículo com `<script>`,
`onerror`, `</script>`) e refletido (filtros, busca do painel, 404, `next`, aviso `?ok=`) — conferido também em navegador
real: nada executa, o JSON-LD continua válido; SQL injection (104 combinações em 13 filtros + painel); entradas extremas
(página 1e308, preço com 20 dígitos, 800 parâmetros); uploads maliciosos (HTML disfarçado, SVG com script, PNG,
bomba de descompressão 8000×8000, sem miniatura, proporção diferente, arquivo poliglota — servido só como
`image/webp` com `nosniff`); upload sem tamanho declarado (411); força bruta (5 erros → 30 min, senha certa recusada
durante o bloqueio, 20 tentativas simultâneas → só 5 conferidas, senha de 100 mil caracteres); limite do formulário de
propostas (6º envio na hora → 429); métricas de outro site (403); arquivos internos (`.env`, `.dev.vars`,
`wrangler.json`, `.git`, `package.json`, migrations, código-fonte, source maps) — todos 404; `npm audit`: 0
vulnerabilidades; histórico do Git sem segredos.

Observações (sem risco): a resposta 403 da proteção CSRF nativa do Astro (`checkOrigin`, antes do middleware) é texto
fixo sem os cabeçalhos de segurança — mantida como camada extra; no `wrangler dev`, um upload acima de 2,5 MB aparece
como "conexão perdida" porque o Worker responde 413 antes de ler o corpo (comportamento do proxy local).

Verificado sem achados nesta fase: SQL injection, XSS, CSRF, open redirect, autorização do painel, uploads
(assinatura real + `nosniff`), fotos de propostas só com login, JWT do Cloudflare Access (issuer + audience),
chaves de teste do Turnstile nunca usadas em produção, dependências (`npm audit`: 0 vulnerabilidades) e varredura
do histórico do Git por segredos (nenhum encontrado).

Fase 6 (teste completo como cliente e como administrador + novo teste de invasão, 25/09/2026):

Feito no servidor de testes (Node, banco isolado) e no runtime da Cloudflare (`wrangler dev`/workerd com o build de
produção): 103 verificações automáticas de ataque, os 33 testes de navegador e testes manuais das telas no computador e
no celular. Correções:

32. **Aviso errado depois de duas ações seguidas:** na lista de veículos, o "voltar para" das ações rápidas levava o
    aviso anterior na URL; a segunda ação (ex.: "Marcar como vendido") exibia a mensagem da primeira ("marcado como
    reservado"). O servidor agora limpa os avisos antigos antes de assinar o novo (teste unitário + E2E).
33. **Login lia o envio inteiro, sem limite de tamanho:** um envio gigante (ex.: 2 MB) no formulário de login era
    carregado na memória. Agora envios acima de 4 KB (ou sem tamanho declarado) nem são lidos e contam como senha
    errada (verificado: 2 MB recusado em 40 ms; a senha certa continua entrando).
34. **Caixas do navegador no painel:** as confirmações usavam o `confirm()` do navegador (caixa no topo da janela, com
    o endereço do site) e o envio de fotos usava o aviso "sair do site?" do navegador. Tudo virou diálogo desenhado na
    própria página; o teste E2E falha se qualquer caixa do navegador aparecer.

Verificado sem achados: acesso ao painel e às APIs sem login (16 rotas), sessões forjadas (4 variações), CSRF (Origin de
outro site, `null`, subdomínio parecido, sem Origin), redirecionamento aberto (7 variações de `next` e `returnTo`),
XSS armazenado e refletido (conferido em navegador real: nenhuma tag injetada e nenhum alerta em Home, estoque, página
do veículo, favoritos e painel), SQL injection (13 filtros × 7 payloads), entradas extremas, uploads maliciosos (HTML
e SVG disfarçados, sem tamanho declarado), IDs de fotos de outro veículo, campos extras no formulário (`id`, `slug`,
`published` ignorados), aviso falso no painel, comemoração sem aviso assinado, "Sair" invalidando cookie copiado e
bloqueio após 5 senhas erradas. A tela de configurações foi removida (404 mesmo com login). Observação: no
`wrangler dev` o proxy local às vezes derruba a conexão quando o Worker recusa (403/413) um envio antes de lê-lo — é
do ambiente local; o próprio Worker registra a resposta correta.

Fase 7 (bateria completa antes de mandar ao cliente, 25/09/2026):

Código (formatação, lint, tipos, 176 testes, 3 builds, `npm audit` 0), 35 testes de navegador, 56 cenários extras
(cliente e administrador, computador, tablet e celular, com monitoramento de erros de console/CSP e rolagem lateral),
103 ataques no Node e no runtime da Cloudflare e 38 verificações na produção (somente leitura: páginas, headers,
redirecionamentos, imagem do WhatsApp e navegador real em 360, 768 e 1440 px). Correções:

35. **Dashboard do painel mais largo que o celular:** as listas (últimos veículos, propostas e ranking de interesse)
    alargavam a página para ~500 px num celular de 375 px (colunas de grid sem limite + nomes que não quebram); a
    barra de baixo ficava difícil de tocar. Corrigido, e o teste E2E agora cobre o painel em 320–1024 px.
36. **Novo/editar veículo em 320 px:** o formulário passava da tela em 16–39 px; a barra "Cancelar / Salvar" agora
    divide a largura.
37. **Palavra longa sem espaço** (modelo ou versão digitados juntos) alargava a página do veículo, a Home e a ficha
    técnica no celular; agora quebra a linha.

Fase 8 (fotos no R2, 26/09/2026):

Migração KV -> R2 com o site no ar (leitura de reserva no KV durante a cópia), 668/668 arquivos conferidos byte a
byte e contra o tamanho gravado no KV; depois o KV saiu da configuração. Teto de 9 GB no painel (o R2 cobra acima de
10 GB). Verificado: 180 testes, 35 E2E, 103 ataques no runtime da Cloudflare com R2 (mesmos 3 itens de ambiente
local das fases anteriores), ciclo de vida das fotos no R2 (rascunho privado e sem cache, público ao publicar,
privado ao tirar do site, apagado ao excluir, espaço liberado) e 64 verificações na produção (501/501 fotos servidas
pelo R2). Correção:

38. **Foto logo após publicar:** o status "público" do veículo ficava guardado alguns segundos por instância; quem
    abrisse o anúncio logo após a publicação podia ver a foto quebrada, e o 404 ficava 60 s no navegador. Agora
    publicar/tirar do site/editar/excluir vale na hora e o 404 de foto não pública não é guardado (teste de
    integração).

**Recomendações para os responsáveis (fora do código)**

- Revogar qualquer token da Cloudflare que tenha sido compartilhado por chat/e-mail e criar outro só quando
  necessário, guardado apenas no lugar de uso.
- Ativar verificação em duas etapas (2FA) nas contas da Cloudflare e do GitHub.
- Proteger o painel com Cloudflare Access (Zero Trust, grátis até 50 usuários): `AUTH_MODE=cloudflare-access`, cada
  sócio entra com o próprio e-mail e código, e `/admin` nem responde para quem não está autorizado.
- Senha do painel com 16+ caracteres aleatórios; trocar quando alguém com acesso deixar a empresa.
- Com domínio próprio: manter o HSTS e, depois de estável, avaliar o _preload_.

**Riscos aceitos / limitações conhecidas**

- "Sair" encerra no servidor todas as sessões abertas do painel (em todos os aparelhos), não só a do navegador atual.
- No Workers o PBKDF2 fica em 50 mil iterações (limite da plataforma): a proteção depende de senha longa e aleatória
  e do limite de tentativas. Para o painel, o modo mais forte é o Cloudflare Access (ver recomendações abaixo).
- Senha única compartilhada no modo `password`; para usuários individuais, usar o modo Cloudflare Access.
- CSP com `style-src 'unsafe-inline'` (estilos embutidos do Astro). Scripts continuam só de arquivos próprios; o
  site não tem nenhum ponto que insira HTML de terceiros, então não há por onde injetar CSS.
- Com o cache de borda (domínio próprio), uma alteração no painel pode levar até ~1 minuto para aparecer no site.
- Excluir veículo é _soft delete_ no banco (registro invisível, histórico preservado); as fotos são apagadas do storage.

## Performance

- Islands: JavaScript só nas páginas que precisam, sem framework no cliente; CSS/JS servidos como arquivos estáticos
  da Cloudflare (grátis, sem passar pelo Worker), com cache imutável.
- Fonte variável única (Instrument Sans, eixos de peso e largura) com preload; `font-display: swap`.
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
