import type { Database } from '@/lib/db/types';

/**
 * Sessões do painel emitidas antes deste instante (segundos Unix) não valem mais.
 * Fica na tabela key/value `site_settings` (os dados institucionais estão em `config/site.ts`).
 */
const SESSIONS_VALID_AFTER_KEY = 'auth_sessions_valid_after';

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  async getSessionsValidAfter(): Promise<number> {
    const row = await this.db.first<{ value: string }>('SELECT value FROM site_settings WHERE key = ?', [
      SESSIONS_VALID_AFTER_KEY,
    ]);
    const value = Number(row?.value ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  async setSessionsValidAfter(seconds: number, updatedAt: string): Promise<void> {
    await this.db.run(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [SESSIONS_VALID_AFTER_KEY, String(seconds), updatedAt],
    );
  }
}
