import type { Client, InStatement, ResultSet } from '@libsql/client';
import type { Database, RunResult, SqlStatement, SqlValue } from './types';

export interface LibsqlConfig {
  url: string;
  authToken?: string | undefined;
}

function rowsToObjects<T>(rs: ResultSet): T[] {
  const { columns, rows } = rs;
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      obj[column] = row[index];
    });
    return obj as T;
  });
}

function toStatement(sql: string, args: SqlValue[] = []): InStatement {
  return { sql, args };
}

class LibsqlDatabase implements Database {
  constructor(private readonly client: Client) {}

  async all<T extends object>(sql: string, args?: SqlValue[]): Promise<T[]> {
    const rs = await this.client.execute(toStatement(sql, args));
    return rowsToObjects<T>(rs);
  }

  async first<T extends object>(sql: string, args?: SqlValue[]): Promise<T | null> {
    const rows = await this.all<T>(sql, args);
    return rows[0] ?? null;
  }

  async run(sql: string, args?: SqlValue[]): Promise<RunResult> {
    const rs = await this.client.execute(toStatement(sql, args));
    return { changes: rs.rowsAffected };
  }

  async batch(statements: SqlStatement[]): Promise<RunResult[]> {
    if (statements.length === 0) return [];
    const results = await this.client.batch(
      statements.map((s) => toStatement(s.sql, s.args)),
      'write',
    );
    return results.map((rs) => ({ changes: rs.rowsAffected }));
  }

  async exec(sql: string): Promise<void> {
    await this.client.executeMultiple(sql);
  }

  async close(): Promise<void> {
    this.client.close();
  }
}

/**
 * Cria a conexão. Para URLs remotas (libsql://, https://) usa o cliente "web"
 * (somente fetch, sem binário nativo). Para arquivos locais usa o cliente Node.
 */
export async function createLibsqlDatabase(config: LibsqlConfig): Promise<Database> {
  const isLocal = config.url.startsWith('file:') || config.url === ':memory:';
  const mod = isLocal ? await import('@libsql/client') : await import('@libsql/client/web');
  const client = mod.createClient({
    url: config.url,
    ...(config.authToken ? { authToken: config.authToken } : {}),
    intMode: 'number',
  });
  if (isLocal) {
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute('PRAGMA journal_mode = WAL').catch(() => undefined);
    await client.execute('PRAGMA busy_timeout = 5000').catch(() => undefined);
  }
  return new LibsqlDatabase(client);
}
