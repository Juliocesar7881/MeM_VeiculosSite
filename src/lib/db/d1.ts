import type { Database, RunResult, SqlStatement, SqlValue } from './types';

/**
 * Implementação da interface Database sobre o Cloudflare D1.
 * Mesmo dialeto (SQLite) e mesmas migrations do libSQL/Turso — os repositórios não mudam.
 */
class D1Db implements Database {
  constructor(private readonly d1: CfD1Database) {}

  private prepare(sql: string, args: SqlValue[] = []): CfD1PreparedStatement {
    const statement = this.d1.prepare(sql);
    return args.length ? statement.bind(...args) : statement;
  }

  async all<T extends object>(sql: string, args?: SqlValue[]): Promise<T[]> {
    const result = await this.prepare(sql, args).all<T>();
    return result.results;
  }

  async first<T extends object>(sql: string, args?: SqlValue[]): Promise<T | null> {
    return this.prepare(sql, args).first<T>();
  }

  async run(sql: string, args?: SqlValue[]): Promise<RunResult> {
    const result = await this.prepare(sql, args).run();
    return { changes: result.meta.changes };
  }

  /** O batch do D1 é transacional: tudo ou nada. */
  async batch(statements: SqlStatement[]): Promise<RunResult[]> {
    if (statements.length === 0) return [];
    const results = await this.d1.batch(statements.map((s) => this.prepare(s.sql, s.args)));
    return results.map((r) => ({ changes: r.meta.changes }));
  }

  async exec(sql: string): Promise<void> {
    await this.d1.exec(sql);
  }

  async close(): Promise<void> {
    // Conexão gerenciada pelo runtime.
  }
}

export function createD1Database(binding: CfD1Database): Database {
  return new D1Db(binding);
}
