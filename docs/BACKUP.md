# Backup e restauração

O que precisa de backup: **banco** (veículos, propostas, configurações, histórico) e **fotos** (`vehicles/` e
`sell-leads/`). O código está no GitHub.

> Os backups contêm dados pessoais das propostas (nome, WhatsApp, e-mail). Guarde-os em local protegido e apague cópias
> antigas que não forem mais necessárias (LGPD). A pasta `backups/` é ignorada pelo Git.

## Rotina recomendada

- **Semanal:** `npm run cf:backup` (banco + fotos da produção).
- **Antes de qualquer mudança grande** (migração de provedor, importação em massa, troca KV → R2): backup completo.
- Mantenha as últimas 4 cópias semanais em um armazenamento pessoal seguro (ex.: Google Drive da empresa).
- O D1 ainda guarda sozinho o histórico dos últimos **7 dias** (Time Travel, plano gratuito).

## Cloudflare (produção atual)

Requer o Wrangler autenticado na conta (`npx wrangler login`).

### Backup

```bash
npm run cf:backup
```

Resultado em `backups/cf-AAAA-MM-DDTHH-MM-SS/`:

- `d1.sql` — exportação completa do D1 (`wrangler d1 export`: estrutura + dados);
- `media/…` — todas as fotos referenciadas no banco (grande, média, miniatura, compartilhamento e fotos de propostas),
  baixadas do KV ou do R2 conforme o `wrangler.jsonc`, com as mesmas chaves.

### Voltar o banco para um momento anterior (Time Travel)

Para desfazer um erro recente (ex.: exclusão indevida) **sem** backup manual:

```bash
npx wrangler d1 time-travel info mm-veiculos                                  # ponto de restauração atual
npx wrangler d1 time-travel restore mm-veiculos --timestamp=2026-09-24T12:00:00Z
```

O banco inteiro volta ao estado daquele momento (até 7 dias atrás no plano gratuito). As fotos não são afetadas —
fotos excluídas depois daquele momento **não voltam** (use o backup com `media/` para isso).

### Restaurar a partir de um backup

`d1.sql` contém `CREATE TABLE`, então a restauração completa é feita num **banco novo e vazio**:

```bash
npx wrangler d1 create mm-veiculos-restaurado --location enam
# troque database_name/database_id do binding DB no wrangler.jsonc para o banco novo
npm run cf:restore -- backups/cf-2026-09-24T12-00-00      # importa o banco + envia as fotos
npm run cf:deploy
```

Só as fotos (ex.: migrar do KV para o R2, ou recuperar fotos apagadas):

```bash
npm run cf:restore -- backups/cf-2026-09-24T12-00-00 --media-only
```

As fotos vão para o storage configurado em `wrangler.jsonc` (`STORAGE_DRIVER` `kv` ou `r2`).

**Testar o backup** (recomendado a cada poucos meses): importe o `d1.sql` num banco SQLite local e confira os dados:

```bash
npx wrangler d1 execute mm-veiculos --local --file=backups/<pasta>/d1.sql   # D1 local vazio (.wrangler/)
```

## Node / Vercel / Turso (alternativa)

Com as variáveis da plataforma carregadas (`DATABASE_URL`, `STORAGE_DRIVER`…), em um arquivo `.env.production.local`
**fora do Git**:

```bash
set -a; source .env.production.local; set +a      # PowerShell: veja abaixo
npm run db:backup -- --with-media
```

PowerShell:

```powershell
Get-Content .env.production.local | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }
npm run db:backup -- --with-media
```

Resultado em `backups/AAAA-MM-DDTHH-MM-SS/`: `database.json` (usado pela restauração), `database.sql`
(`INSERT OR REPLACE` de todas as tabelas, importável no D1/SQLite) e `media/…`.

Restauração (destino = variáveis de ambiente atuais):

```bash
npm run db:restore -- backups/2026-09-24T12-00-00               # só banco
npm run db:restore -- backups/2026-09-24T12-00-00 --with-media  # banco + fotos
npm run db:restore -- backups/2026-09-24T12-00-00 --with-media --yes   # destino remoto exige confirmação
```

O script aplica as migrations no destino e grava os registros com `INSERT OR REPLACE`.

## Recursos dos provedores

| Provedor      | Recurso                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Cloudflare D1 | Time Travel (7 dias no gratuito, 30 no pago); `wrangler d1 export mm-veiculos --remote --output=backup.sql` |
| Workers KV    | Sem versionamento: arquivos apagados não voltam — por isso o backup com `media/`                            |
| Cloudflare R2 | Sem versionamento automático; `cf:backup` baixa as fotos (ou `rclone` com remote S3 apontando para o R2)    |
| Turso         | Restauração pontual (1 dia no gratuito): `turso db create novo --from-db mm-veiculos --timestamp <ISO>`     |
| Vercel Blob   | Sem versionamento; backup com `db:backup -- --with-media`                                                   |
