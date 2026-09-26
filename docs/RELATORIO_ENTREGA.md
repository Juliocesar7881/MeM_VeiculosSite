# Relatório de entrega — M&M Veículos

Data: **25/09/2026** · Repositório: https://github.com/Juliocesar7881/MeM_VeiculosSite

## 1. Resumo

|                    |                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Situação**       | Sistema completo (site público + painel administrativo), publicado e testado                                                                          |
| **Endereço atual** | https://mm-veiculos.lupinho7881.workers.dev (temporário, para validação) · painel em `/admin`                                                         |
| **Hospedagem**     | Cloudflare, plano gratuito, conta **lupinho7881@gmail.com** (só este projeto): Workers, D1, R2, Turnstile                                             |
| **Custo mensal**   | **R$ 0**. Custo obrigatório: só o **domínio** (~R$ 40/ano no Registro.br para `.com.br`)                                                              |
| **Dados no ar**    | Configurações oficiais da empresa já cadastradas; estoque **vazio** (“Novos veículos em breve”) até a M&M cadastrar os veículos reais. Nada inventado |
| **Buscadores**     | Bloqueados de propósito até o domínio definitivo (evita o Google indexar a URL temporária)                                                            |

**Por que Cloudflare e não Vercel:** a primeira versão foi preparada para a Vercel porque a mensagem inicial dizia
“pela vercel msm por enquanto”. A Vercel acabou não sendo publicada (a CLI não estava autenticada e o plano gratuito
dela é **não comercial**). O site foi publicado na **Cloudflare**, como pedido: gratuita, com uso comercial permitido e
mais rápida no Brasil. O código continua compilando para a Vercel como alternativa.

## 2. O que está pronto

**Site público**

- Home com busca, atalhos por categoria (carros, motos, scooters, pesados, máquinas agrícolas), destaques, ofertas,
  repasses, chamada “Quer vender seu veículo?” e bloco da empresa.
- Estoque com busca, filtros (categoria, marca, modelo, ano, preço, câmbio, combustível, oferta, repasse), ordenação e
  paginação — tudo na URL, compartilhável.
- Página do veículo: galeria com swipe, miniaturas e tela cheia; ficha técnica; opcionais; “Tenho interesse” e
  “Simular financiamento” pelo WhatsApp com mensagem pronta; veículos semelhantes; vendido → “Procurando algo parecido?”.
- Ofertas (“De R$ X por R$ Y” calculado de verdade, com período opcional), Repasses (texto configurável),
  Favoritos (sem login), Empresa, Contato, Política de privacidade (LGPD).
- “Anuncie seu veículo”: formulário com até 6 fotos comprimidas no celular, Turnstile, consentimento LGPD.
- Prévia bonita no WhatsApp/Facebook (foto do veículo 1200×630 com a logo, título e preço).
- SEO: títulos, descrições, dados estruturados (AutoDealer, Car/Vehicle, Offer, Breadcrumb), sitemap e robots.

**Painel administrativo**

- Login com senha (sessão segura de 12 h, bloqueio após tentativas erradas).
- Dashboard, lista de veículos com filtros e ações rápidas (publicar, destacar, oferta, repasse, reservar, vender,
  arquivar, excluir).
- **Interesse por veículo:** visualizações e cliques no WhatsApp dos últimos 30 dias (ranking no dashboard e números na
  página de cada veículo) — contagem anônima, sem cookies e sem dados do visitante.
- Cadastro/edição completos; fotos com envio múltiplo, arrastar para ordenar, capa, exclusão; cada foto é otimizada
  no navegador em 4 versões (computador, celular, miniatura, WhatsApp).
- Propostas recebidas: status, anotações internas, “Chamar no WhatsApp”, **transformar em veículo** (rascunho com as
  fotos copiadas), exclusão definitiva (LGPD).
- Confirmações na própria tela (nunca as caixas do navegador), avisos animados ao salvar, animação ao cadastrar ou
  publicar um veículo, barra de progresso no envio de fotos e aviso ao sair com dados não salvos.
- Contatos, redes e textos institucionais ficam no código (`src/config/site.ts`): o painel não tem tela de
  configurações; mudanças nesses dados são feitas pelo responsável técnico.

**Técnico**

- Segurança: CSP rígida, HSTS, proteção CSRF, SQL parametrizado, validação no servidor, uploads verificados pelo
  conteúdo real, rate limit, IP só em hash, fotos de propostas privadas, nenhum segredo no código.
- Desempenho: nota 97–100 no Lighthouse mobile e 100 no desktop, na URL publicada.
- Backup da produção com um comando (`npm run cf:backup`) + histórico automático de 7 dias do banco.
- Domínio pronto para ligar com um comando (`npm run cf:domain`), com endereço único (301 do “sem www” e do
  `workers.dev` para o endereço oficial).
- Documentação: [README](../README.md), [DEPLOY](DEPLOY.md), [MANUAL_ADMIN](MANUAL_ADMIN.md) (para a M&M),
  [ARQUITETURA](ARQUITETURA.md), [BACKUP](BACKUP.md), [AUDITORIA](AUDITORIA.md).

## 3. Como foi verificado

| Verificação                                                          | Resultado                                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testes automáticos (unitários + integração)                          | 176 passando                                                                                                                                      |
| Testes de navegador (E2E, computador e celular, 11 larguras de tela) | 35 passando                                                                                                                                       |
| Lint, tipos (TypeScript estrito), formatação                         | sem erros                                                                                                                                         |
| Vulnerabilidades em dependências (`npm audit`)                       | 0                                                                                                                                                 |
| Teste completo na produção                                           | login (senha antiga recusada, nova aceita), cadastro, fotos, publicação, página pública, prévia do WhatsApp, métricas no painel, exclusão, logout |
| Lighthouse na produção (mobile / desktop)                            | Home 99/100 · Estoque 100/100 · Veículo 97–98/100 · Anuncie 99/100 · Ofertas 100/100 · Acessibilidade e Boas práticas 100                         |
| Backup da produção                                                   | exportação do banco + fotos funcionando (backup inicial feito)                                                                                    |

Os veículos de teste usados nas medições foram excluídos; o site no ar não mostra nenhum dado fictício.

## 4. Situação dos itens de entrega

### A. Feito

| Item                              | Situação                                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Senha de desenvolvimento trocada  | ✅ Senha forte aleatória no Worker; a antiga não entra mais                                                                                                              |
| Conta Cloudflare dedicada         | ✅ Tudo recriado na conta **lupinho7881@gmail.com**, sem outros projetos dividindo a cota                                                                                |
| Backup inicial                    | ✅ `npm run cf:backup` (repetir após o cadastro real e semanalmente)                                                                                                     |
| Preparação do domínio             | ✅ `npm run cf:domain -- <domínio>` faz Custom Domains, redirecionamentos, indexação e Turnstile, e desfaz tudo se falhar                                                |
| Métricas de interesse por veículo | ✅ Visualizações e cliques no WhatsApp no painel                                                                                                                         |
| Disponibilidade do domínio        | ✅ Consultado em 24/09/2026: **`mmveiculos.com.br` livre** (também `mmveiculossc.com.br`); `mmveiculos.net.br` tem dono                                                  |
| Cópia antiga (conta loopsluchini) | ✅ `mm-veiculos.visor-crypto.workers.dev` agora só redireciona (301) para o site atual; a senha antiga não entra mais em lugar nenhum. Nada do Visor Crypto foi alterado |

### B. Só o responsável pode fazer (exige compra, cartão ou login pessoal)

| #   | Item                                                                                                                                                                                                                                                                                              | Como                                                                                                                                                                         | Prioridade        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | **Comprar o domínio** no Registro.br (titular com CPF/CNPJ, de preferência o CNPJ da M&M)                                                                                                                                                                                                         | registro.br → pesquisar `mmveiculos.com.br` → contratar                                                                                                                      | **Obrigatório**   |
| 2   | **Adicionar o domínio na Cloudflare** (conta lupinho7881) e trocar os nameservers no Registro.br                                                                                                                                                                                                  | [DEPLOY.md, passo 6](DEPLOY.md#6-domínio-próprio). Depois, rodar `npm run cf:domain -- mmveiculos.com.br` (ou pedir para eu rodar)                                           | **Obrigatório**   |
| 3   | ✅ **R2 ativado** (26/09/2026): fotos migradas do KV, conferidas byte a byte; teto de 9 GB no painel (nunca cobra)                                                                                                                                                                                | Painel Cloudflare → R2 → ativar (pode pedir cartão, sem cobrança dentro do grátis). Depois eu crio o bucket e migro ([passo 7](DEPLOY.md#7-fotos-no-r2-ativado-em-26092026)) | Muito recomendado |
| 4   | Opcional: apagar o banco e o KV antigos que ficaram sem uso na conta loopsluchini@gmail.com (D1 `mm-veiculos`, KV `mm-veiculos-media`, widget Turnstile “M&M Veículos”) — **não** apagar `visor-db`, `CALENDAR_KV` nem `visor-crypto-privacy-policy`. Não custam nada e não têm dados de clientes | Painel da Cloudflare dessa conta                                                                                                                                             | Opcional          |
| 5   | Entregar a senha do painel à M&M por um canal seguro (ou trocar por uma escolhida por eles)                                                                                                                                                                                                       | [DEPLOY.md, passo 4](DEPLOY.md#4-senha-do-painel-e-secrets)                                                                                                                  | Na entrega        |
| 6   | Google Search Console (com o domínio no ar)                                                                                                                                                                                                                                                       | passo 6                                                                                                                                                                      | Recomendado       |
| 7   | Opcional: Cloudflare Access (login individual por e-mail, até 50 grátis)                                                                                                                                                                                                                          | [passo 8](DEPLOY.md#8-opcional-cloudflare-access-no-painel)                                                                                                                  | Opcional          |
| 8   | Opcional: aviso por e-mail a cada nova proposta (conta no Resend)                                                                                                                                                                                                                                 | [passo 9](DEPLOY.md#9-opcional-aviso-de-propostas-por-e-mail)                                                                                                                | Opcional          |

### C. Informações e materiais que dependem da M&M

Nada disso foi inventado; o site simplesmente não mostra o que não foi informado.

| Item                                                                                                                             | Onde entra                           |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Confirmar o **nome do domínio** e quem será o titular                                                                            | Compra do domínio                    |
| **Veículos reais**: dados, preços e fotos                                                                                        | Painel → Novo veículo                |
| **Endereço** completo e **horário de funcionamento** (se quiserem exibir)                                                        | `src/config/site.ts` (técnico)       |
| Confirmar contatos já cadastrados: WhatsApp +55 48 9641-0338, Instagram @mmveiculos.sc, Facebook, e-mail mmveiculos.sc@gmail.com | `src/config/site.ts` (técnico)       |
| Texto sobre repasses (condições)                                                                                                 | `src/config/site.ts` (técnico)       |
| ✅ **Logo oficial** recebida e aplicada (25/09/2026); se houver versão em resolução maior, trocar o arquivo                      | `docs/brand/` → `npm run brand:logo` |
| CNPJ, história/tempo de mercado, parceiros de financiamento (só se quiserem exibir)                                              | Pequena alteração nos textos         |
| **Aprovação** do layout e dos textos (validação na URL temporária)                                                               | —                                    |

### D. Ideias para depois (opcionais)

- Perfil da empresa no Google (Google Business Profile) apontando para o site.
- Cloudflare Web Analytics (visitas gerais do site, grátis e sem cookies) — exige liberar o script na CSP.

## 5. Limites do plano gratuito e capacidade

Medido em 25/09/2026 no banco da Cloudflare (D1 local), com estoques simulados de 50 a 2.000 veículos com 10 fotos
cada. Linhas lidas no banco por página (depois da otimização dos cards, que reduziu a leitura em ~2,4×):

| Veículos no estoque | Home   | Lista de veículos | Lista filtrada (ex.: Motos) | Página do veículo |
| ------------------- | ------ | ----------------- | --------------------------- | ----------------- |
| 50                  | 989    | 786               | 348                         | 152               |
| 150                 | 2.171  | 1.686             | 920                         | 243               |
| 300                 | 3.868  | 3.036             | 1.520                       | 383               |
| 1.000               | 11.786 | 9.336             | 4.322                       | 434               |

| Recurso (plano grátis)           | Limite                                        | Na prática                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fotos no R2 (em uso desde 26/09) | 10 GB e 1 mi gravações/mês                    | Foto real da loja ≈ 0,8 MB (4 versões): **~11 mil fotos ≈ 900 veículos com 12 fotos** até o teto de 9 GB do painel (que evita qualquer cobrança). Vendidos e arquivados ocupam; excluir libera |
| Banco (D1) — espaço              | 500 MB por banco                              | Dezenas de milhares de veículos (não é o limite)                                                                                                                                               |
| Banco (D1) — leituras            | 5 mi linhas/dia                               | Com 150 veículos, ~1.100 visitas completas/dia (Home + lista + 2 veículos); link direto de um veículo custa ~300 linhas                                                                        |
| Requisições (Workers)            | 100 mil/dia (páginas, fotos, contadores)      | ~60 por visita completa ≈ 1.600 visitas/dia; arquivos estáticos (CSS, JS, logo) não contam                                                                                                     |
| Pessoas ao mesmo tempo           | sem limite fixo (a Cloudflare escala sozinha) | Centenas de pessoas simultâneas sem ficar lento; o que limita é o total do dia                                                                                                                 |

Com o domínio próprio, as páginas públicas ficam 60 s no cache da Cloudflare (a Home e a lista não consultam o banco
a cada visita), o que aumenta a folga. Se um limite diário estourar, o site volta às 21h (horário de Brasília), quando
a cota renova; o painel mostra uma mensagem clara e o formulário público salva a proposta mesmo sem as fotos.
Crescendo além disso (centenas de veículos ou milhares de visitas por dia), o plano pago da Cloudflare custa
**US$ 5/mês** (10 mi requisições/mês e 25 bilhões de linhas lidas/mês).

## 6. Acessos e segredos

- **Nenhuma senha ou chave está no repositório.** A senha do painel foi passada fora do código.
- Segredos da produção ficam nos _secrets_ do Worker (`ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `IP_HASH_SALT`,
  `TURNSTILE_SECRET_KEY`); a chave pública do Turnstile e demais configurações ficam em `wrangler.jsonc`.
- Recursos na Cloudflare (conta lupinho7881@gmail.com): Worker `mm-veiculos`, banco D1 `mm-veiculos`, R2
  `mm-veiculos-media` (binding `MEDIA`, privado), widget Turnstile “M&M Veiculos”. O KV `mm-veiculos-media` (cópia
  antiga das fotos, não usada desde 26/09/2026) pode ser apagado no painel.
