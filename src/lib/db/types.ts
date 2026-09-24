/**
 * Contrato mínimo de banco de dados usado pelos repositories.
 *
 * Implementações:
 *  - libsql.ts  -> SQLite local (arquivo) e Turso (produção na Vercel)
 *  - Futuro: Cloudflare D1 (mesma sintaxe SQLite; ver docs/ARQUITETURA.md)
 *
 * Todas as consultas usam parâmetros posicionais (?), nunca concatenação de valores.
 */
export type SqlValue = string | number | bigint | null | Uint8Array;

export interface SqlStatement {
  sql: string;
  args?: SqlValue[];
}

export interface RunResult {
  changes: number;
}

export interface Database {
  all<T extends object>(sql: string, args?: SqlValue[]): Promise<T[]>;
  first<T extends object>(sql: string, args?: SqlValue[]): Promise<T | null>;
  run(sql: string, args?: SqlValue[]): Promise<RunResult>;
  /** Executa as instruções em uma única transação (tudo ou nada). */
  batch(statements: SqlStatement[]): Promise<RunResult[]>;
  /** Executa um script SQL (migrations). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export const bool = (value: boolean): number => (value ? 1 : 0);
export const toBool = (value: unknown): boolean => value === 1 || value === true || value === '1';
