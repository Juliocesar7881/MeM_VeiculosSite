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

  /**
   * Conta tentativas seguidas: a contagem recomeça do 1 quando a anterior foi em `staleBefore`
   * ou antes. Aqui `window_start` guarda o momento da última tentativa.
   */
  async hitStreak(key: string, nowSeconds: number, staleBefore: number): Promise<number> {
    const row = await this.db.first<{ count: number }>(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start > ? THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start
       RETURNING count`,
      [key, nowSeconds, staleBefore],
    );
    return Number(row?.count ?? 1);
  }

  /** Bloqueio: `window_start` guarda até quando (segundos Unix) a chave fica bloqueada. */
  async lockedUntil(key: string): Promise<number> {
    const row = await this.db.first<{ window_start: number }>('SELECT window_start FROM rate_limits WHERE key = ?', [
      key,
    ]);
    return Number(row?.window_start ?? 0);
  }

  async lock(key: string, untilSeconds: number): Promise<void> {
    await this.db.run(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
      [key, untilSeconds],
    );
  }

  async reset(key: string): Promise<void> {
    await this.db.run('DELETE FROM rate_limits WHERE key = ?', [key]);
  }

  async purgeBefore(windowStart: number): Promise<void> {
    await this.db.run('DELETE FROM rate_limits WHERE window_start < ?', [windowStart]);
  }
}
