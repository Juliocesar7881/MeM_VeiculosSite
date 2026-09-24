import type { Database } from '@/lib/db/types';

/**
 * Rate limiting persistido no banco (funciona entre instâncias serverless).
 * Janela fixa: a chave inclui o identificador; window_start marca a janela atual.
 */
export class RateLimitRepository {
  constructor(private readonly db: Database) {}

  /** Registra uma tentativa e retorna quantas ocorreram na janela atual. */
  async hit(key: string, windowStart: number): Promise<number> {
    const row = await this.db.first<{ count: number }>(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
      [key, windowStart],
    );
    return Number(row?.count ?? 1);
  }

  async reset(key: string): Promise<void> {
    await this.db.run('DELETE FROM rate_limits WHERE key = ?', [key]);
  }

  async purgeBefore(windowStart: number): Promise<void> {
    await this.db.run('DELETE FROM rate_limits WHERE window_start < ?', [windowStart]);
  }
}
