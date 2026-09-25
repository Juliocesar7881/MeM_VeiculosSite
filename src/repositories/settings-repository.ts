import type { Database } from '@/lib/db/types';
import type { SiteSettings, SiteSettingsKey } from '@/types/settings';

/** Mapeamento campo (camelCase) <-> chave no banco (snake_case). */
export const SETTINGS_KEY_MAP: Record<SiteSettingsKey, string> = {
  businessName: 'business_name',
  slogan: 'slogan',
  whatsapp: 'whatsapp',
  phone: 'phone',
  instagram: 'instagram',
  facebook: 'facebook',
  email: 'email',
  city: 'city',
  state: 'state',
  address: 'address',
  openingHours: 'opening_hours',
  showSoldVehicles: 'show_sold_vehicles',
  sellVehicleCta: 'sell_vehicle_cta',
  repasseDescription: 'repasse_description',
};

const BOOLEAN_KEYS: SiteSettingsKey[] = ['showSoldVehicles'];

/**
 * Sessões do painel emitidas antes deste instante (segundos Unix) não valem mais.
 * Fica na mesma tabela key/value, fora do SETTINGS_KEY_MAP (não aparece no formulário).
 */
const SESSIONS_VALID_AFTER_KEY = 'auth_sessions_valid_after';

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  /** Lê as configurações, completando com os valores padrão o que não existir. */
  async getAll(defaults: SiteSettings): Promise<SiteSettings> {
    const rows = await this.db.all<{ key: string; value: string }>('SELECT key, value FROM site_settings');
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const result: Record<string, string | boolean> = { ...defaults };
    for (const field of Object.keys(SETTINGS_KEY_MAP) as SiteSettingsKey[]) {
      const raw = byKey.get(SETTINGS_KEY_MAP[field]);
      if (raw === undefined) continue;
      result[field] = BOOLEAN_KEYS.includes(field) ? raw === 'true' : raw;
    }
    return result as unknown as SiteSettings;
  }

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

  async saveAll(settings: SiteSettings, updatedAt: string): Promise<void> {
    await this.db.batch(
      (Object.keys(SETTINGS_KEY_MAP) as SiteSettingsKey[]).map((field) => ({
        sql: `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        args: [SETTINGS_KEY_MAP[field], String(settings[field]), updatedAt],
      })),
    );
  }
}
