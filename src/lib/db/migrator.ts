import type { Database } from './types';

export interface MigrationFile {
  name: string;
  sql: string;
}

/**
 * Divide um script SQL em instruções. Suporta comentários "--" e strings com ';'.
 * As migrations deste projeto não usam triggers (BEGIN...END), o que mantém o split simples.
 */
export function splitSqlStatements(script: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  for (let i = 0; i < script.length; i += 1) {
    const char = script[i];
    const next = script[i + 1];
    if (!inString && char === '-' && next === '-') {
      const end = script.indexOf('\n', i);
      i = end === -1 ? script.length : end;
      current += '\n';
      continue;
    }
    if (char === "'") {
      if (inString && next === "'") {
        current += "''";
        i += 1;
        continue;
      }
      inString = !inString;
    }
    if (char === ';' && !inString) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

/**
 * Aplica migrations pendentes. Usa a tabela `d1_migrations` com o mesmo formato do
 * Wrangler (Cloudflare D1), permitindo migrar o banco para o D1 no futuro sem
 * reaplicar migrations.
 */
export async function applyMigrations(
  db: Database,
  migrations: MigrationFile[],
  log: (message: string) => void = () => undefined,
): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );`);

  const appliedRows = await db.all<{ name: string }>('SELECT name FROM d1_migrations ORDER BY id');
  const applied = new Set(appliedRows.map((r) => r.name));
  const pending = [...migrations].sort((a, b) => a.name.localeCompare(b.name)).filter((m) => !applied.has(m.name));

  const done: string[] = [];
  for (const migration of pending) {
    const statements = splitSqlStatements(migration.sql);
    await db.batch([
      ...statements.map((sql) => ({ sql })),
      { sql: 'INSERT INTO d1_migrations (name) VALUES (?)', args: [migration.name] },
    ]);
    log(`✔ migration aplicada: ${migration.name}`);
    done.push(migration.name);
  }
  if (done.length === 0) log('Banco já está atualizado.');
  return done;
}
