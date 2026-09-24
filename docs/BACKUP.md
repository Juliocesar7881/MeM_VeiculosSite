# Backup e restauração

O que precisa de backup: **banco** (veículos, propostas, configurações, histórico) e **fotos** (`vehicles/` e
`sell-leads/`). O código está no GitHub.

> Os backups contêm dados pessoais das propostas (nome, WhatsApp, e-mail). Guarde-os em local protegido e apague cópias
> antigas que não forem mais necessárias (LGPD).

## Rotina recomendada

- **Semanal:** `npm run db:backup -- --with-media` com as variáveis de produção.
- **Antes de qualquer mudança grande** (migração de provedor, importação em massa): backup completo.
- Mantenha as últimas 4 cópias semanais em um armazenamento pessoal seguro (ex.: Google Drive da empresa).

## Backup (produção)

Crie no seu computador um arquivo `.env.production.local` **fora do Git** (o `.gitignore` já ignora `.env.*`) com:

```ini
DATABASE_URL=libsql://mm-veiculos-<org>.turso.io
DATABASE_AUTH_TOKEN=<token do Turso>
STORAGE_DRIVER=vercel-blob
BLOB_READ_WRITE_TOKEN=<token do store Blob>
# ou, se usar R2:
# STORAGE_DRIVER=s3
# S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=...
```

E rode (PowerShell):

```powershell
Get-Content .env.production.local | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] } }
npm run db:backup -- --with-media
```

ou (bash):

```bash
set -a; source .env.production.local; set +a
npm run db:backup -- --with-media
```

Resultado em `backups/AAAA-MM-DDTHH-MM-SS/`:

- `database.json` — todos os dados (usado pela restauração);
- `database.sql` — `INSERT OR REPLACE` de todas as tabelas (útil para importar no D1/SQLite);
- `media/…` — todas as fotos referenciadas no banco, com as mesmas chaves.

## Restauração

```bash
# Destino = variáveis de ambiente atuais (DATABASE_URL, STORAGE_DRIVER...)
npm run db:restore -- backups/2026-09-24T12-00-00               # só banco
npm run db:restore -- backups/2026-09-24T12-00-00 --with-media  # banco + fotos
# destino remoto exige confirmação explícita:
npm run db:restore -- backups/2026-09-24T12-00-00 --with-media --yes
```

O script aplica as migrations no destino e grava os registros com `INSERT OR REPLACE` (registros com o mesmo id são
substituídos; os demais permanecem). Para restaurar em um banco limpo, crie um banco novo e aponte o `DATABASE_URL`
para ele.

**Testar o backup** (recomendado a cada poucos meses): restaure no banco local

```bash
DATABASE_URL=file:.data/restore-test.db STORAGE_DRIVER=local LOCAL_STORAGE_DIR=.data/restore-test \
  npm run db:restore -- backups/<pasta> --with-media
```

## Recursos dos provedores

### Turso

- Restauração pontual (*point-in-time*): 1 dia no plano gratuito — `turso db create mm-veiculos-restaurado --from-db mm-veiculos --timestamp <data ISO>`.
- Dump SQL direto: `turso db shell mm-veiculos .dump > dump.sql`.
- Restaurar um dump num banco novo: `turso db create mm-veiculos-novo --from-dump dump.sql`.

### Vercel Blob

- Não há versionamento automático: arquivos apagados não voltam. Por isso o backup com `--with-media`.
- Listagem/download manual: `vercel blob list` (CLI da Vercel).

### Cloudflare R2 (se usado)

- Cópia do bucket com `rclone` (remote S3 apontando para o R2) ou o próprio `npm run db:backup -- --with-media`.

### Cloudflare D1 (após migração)

- Time Travel (restauração pontual de 30 dias no plano pago; 7 dias no gratuito — confira a documentação vigente):
  `wrangler d1 time-travel restore <db> --timestamp=<ISO>`.
- Exportação: `wrangler d1 export <db> --remote --output=backup.sql`.
- Importação de backup deste projeto: `wrangler d1 execute <db> --remote --file=backups/<pasta>/database.sql`
  (após `wrangler d1 migrations apply <db> --remote`).
