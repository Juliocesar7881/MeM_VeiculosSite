# Relatório de entrega — M&M Veículos

Data: **24/09/2026** · Repositório: https://github.com/Juliocesar7881/MeM_VeiculosSite

## 1. Resumo

|                    |                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Situação**       | Sistema completo (site público + painel administrativo), publicado e testado                                                                          |
| **Endereço atual** | https://mm-veiculos.lupinho7881.workers.dev (temporário, para validação) · painel em `/admin`                                                         |
| **Hospedagem**     | Cloudflare, plano gratuito: Workers (site), D1 (banco), KV (fotos), Turnstile (anti-spam)                                                             |
| **Custo mensal**   | **R$ 0**. Custo obrigatório: só o **domínio** (~R$ 40/ano no Registro.br para `.com.br`)                                                              |
| **Dados no ar**    | Configurações oficiais da empresa já cadastradas; estoque **vazio** (“Novos veículos em breve”) até a M&M cadastrar os veículos reais. Nada inventado |
| **Buscadores**     | Bloqueados de propósito até o domínio definitivo (evita o Google indexar a URL temporária)                                                            |

**Por que Cloudflare e não Vercel:** a primeira versão foi preparada para a Vercel porque a mensagem inicial dizia
“pela vercel msm por enquanto”. A Vercel acabou não sendo publicada (a CLI não estava autenticada e o plano gratuito
dela é **não comercial**). O site foi publicado na **Cloudflare**, como você pediu: gratuita, com uso comercial
permitido e mais rápida no Brasil. O código continua compilando para a Vercel como alternativa, mas a produção é a
Cloudflare.

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
- Cadastro/edição completos; fotos com envio múltiplo, arrastar para ordenar, capa, exclusão; cada foto é otimizada
  no navegador em 4 versões (computador, celular, miniatura, WhatsApp).
- Propostas recebidas: status, anotações internas, “Chamar no WhatsApp”, **transformar em veículo** (rascunho com as
  fotos copiadas), exclusão definitiva (LGPD).
- Configurações: WhatsApp, telefone, e-mail, Instagram, Facebook, cidade, endereço, horário, textos.

**Técnico**

- Segurança: CSP rígida, HSTS, proteção CSRF, SQL parametrizado, validação no servidor, uploads verificados pelo
  conteúdo real, rate limit, IP só em hash, fotos de propostas privadas, nenhum segredo no código.
- Desempenho: nota 97–100 no Lighthouse mobile e 100 no desktop, na URL publicada.
- Backup da produção com um comando (`npm run cf:backup`) + histórico automático de 7 dias do banco.
- Documentação: [README](../README.md), [DEPLOY](DEPLOY.md), [MANUAL_ADMIN](MANUAL_ADMIN.md) (para a M&M),
  [ARQUITETURA](ARQUITETURA.md), [BACKUP](BACKUP.md), [AUDITORIA](AUDITORIA.md).

## 3. Como foi verificado

| Verificação                                                          | Resultado                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Testes automáticos (unitários + integração)                          | 140 passando                                                                                                              |
| Testes de navegador (E2E, computador e celular, 11 larguras de tela) | 29 passando                                                                                                               |
| Lint, tipos (TypeScript estrito), formatação                         | sem erros                                                                                                                 |
| Vulnerabilidades em dependências (`npm audit`)                       | 0                                                                                                                         |
| Teste completo na produção                                           | login, cadastro, fotos, publicação, página pública, prévia do WhatsApp, exclusão, logout                                  |
| Lighthouse na produção (mobile / desktop)                            | Home 99/100 · Estoque 100/100 · Veículo 97–98/100 · Anuncie 99/100 · Ofertas 100/100 · Acessibilidade e Boas práticas 100 |
| Backup da produção                                                   | exportação do banco + fotos funcionando                                                                                   |

Os veículos de teste usados nas medições foram excluídos; o site no ar não mostra nenhum dado fictício.

## 4. O que falta para entregar ao cliente

### A. Ações técnicas (responsável técnico)

| #   | Item                                                                                                                                                                                                                                                         | Como                                                                                                                                            | Prioridade               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | **Trocar a senha de desenvolvimento** do painel e entregar a nova ao cliente por um canal seguro                                                                                                                                                             | [DEPLOY.md, passo 4](DEPLOY.md#4-senha-do-painel-e-secrets)                                                                                     | **Obrigatório**          |
| 2   | **Comprar e conectar o domínio** (Registro.br → nameservers da Cloudflare → Custom Domain no Worker)                                                                                                                                                         | [DEPLOY.md, passo 6](DEPLOY.md#6-domínio-próprio)                                                                                               | **Obrigatório**          |
| 3   | Com o domínio: `PUBLIC_SITE_URL`, `ALLOW_INDEXING=true`, domínio nos hostnames do Turnstile, `npm run cf:deploy`                                                                                                                                             | passo 6                                                                                                                                         | **Obrigatório**          |
| 4   | **Ativar o R2** antes do cadastro do estoque inicial (o KV grátis aceita ~250 fotos de veículo por dia)                                                                                                                                                      | [DEPLOY.md, passo 7](DEPLOY.md#7-ativar-o-r2-para-as-fotos-recomendado) — pode exigir cartão na conta Cloudflare, sem cobrança dentro do grátis | Muito recomendado        |
| 5   | Google Search Console: verificar o domínio e enviar o `sitemap.xml`                                                                                                                                                                                          | passo 6                                                                                                                                         | Recomendado              |
| 6   | Primeiro backup depois do cadastro real e rotina semanal                                                                                                                                                                                                     | [BACKUP.md](BACKUP.md)                                                                                                                          | Recomendado              |
| 7   | Definir a **titularidade da conta Cloudflare**: o site está na conta **lupinho7881@gmail.com**, dedicada só a este projeto. Opções: manter e administrar para o cliente, adicionar a M&M como membro (Manage Account → Members) ou recriar numa conta da M&M | [DEPLOY.md, passo 11](DEPLOY.md#11-recriar-tudo-em-outra-conta)                                                                                 | Decidir antes da entrega |
| 8   | Opcional: Cloudflare Access (cada pessoa entra com o próprio e-mail, até 50 grátis)                                                                                                                                                                          | passo 8                                                                                                                                         | Opcional                 |
| 9   | Opcional: aviso por e-mail a cada nova proposta (Resend, grátis)                                                                                                                                                                                             | passo 9                                                                                                                                         | Opcional                 |
| 10  | Opcional: desligar a URL `*.workers.dev` depois que o domínio estiver no ar                                                                                                                                                                                  | passo 6.11                                                                                                                                      | Opcional                 |

### B. Informações e materiais que dependem da M&M

Nada disso foi inventado; o site simplesmente não mostra o que não foi informado.

| Item                                                                                                                             | Onde entra                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Nome do domínio** desejado (ex.: `mmveiculos.com.br`) e quem será o titular no Registro.br                                     | Compra do domínio                        |
| **Veículos reais**: dados, preços e fotos                                                                                        | Painel → Novo veículo                    |
| **Endereço** completo e **horário de funcionamento** (se quiserem exibir)                                                        | Painel → Configurações                   |
| Confirmar contatos já cadastrados: WhatsApp +55 48 9641-0338, Instagram @mmveiculos.sc, Facebook, e-mail mmveiculos.sc@gmail.com | Painel → Configurações                   |
| Texto sobre repasses (condições)                                                                                                 | Painel → Configurações                   |
| **Logo original** em alta resolução (a atual foi redesenhada em vetor a partir do Instagram)                                     | `docs/brand/` → `npm run brand:logo`     |
| CNPJ, história/tempo de mercado, parceiros de financiamento (só se quiserem exibir)                                              | Exige pequena alteração no código/textos |
| Quem terá acesso ao painel e qual e-mail recebe avisos de propostas                                                              | Senha / Access / Resend                  |
| **Aprovação** do layout e dos textos (validação na URL temporária)                                                               | —                                        |

### C. Melhorias futuras (fora do escopo, opcionais)

- Métricas de visitas sem cookies (Cloudflare Web Analytics, grátis) — exige liberar o script na CSP.
- Perfil da empresa no Google (Google Business Profile) apontando para o site.
- Contagem de cliques no WhatsApp por veículo (para saber quais anúncios geram mais contatos).

## 5. Limites do plano gratuito (o que observar)

| Recurso                       | Limite diário                              | Na prática                                                        |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| Requisições ao site (Workers) | 100 mil/dia                                | Milhares de visitas por dia; arquivos estáticos não contam        |
| Banco (D1)                    | 5 mi leituras e 100 mil escritas/dia       | Muito acima do necessário                                         |
| Fotos no KV                   | 100 mil leituras e **1 mil gravações/dia** | ~250 fotos de veículo por dia — resolvido ativando o R2 (item A4) |

Se um limite estourar, o painel mostra uma mensagem clara (e o formulário público salva a proposta mesmo sem as
fotos). Crescendo além disso, o plano pago da Cloudflare custa US$ 5/mês.

## 6. Acessos e segredos

- **Nenhuma senha ou chave está no repositório.** A senha de desenvolvimento do painel foi combinada fora do código e
  deve ser trocada (item A1).
- Segredos da produção ficam nos _secrets_ do Worker (`ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `IP_HASH_SALT`,
  `TURNSTILE_SECRET_KEY`); a chave pública do Turnstile e demais configurações ficam em `wrangler.jsonc`.
- Recursos na Cloudflare: Worker `mm-veiculos`, banco D1 `mm-veiculos`, KV `MEDIA_KV`, widget Turnstile “M&M Veículos”.
