import type { Database } from '@/lib/db/types';

export type StatsEvent = 'view' | 'whatsapp';

export interface VehicleStats {
  views: number;
  whatsappClicks: number;
}

export interface VehicleStatsRow extends VehicleStats {
  vehicleId: string;
  brand: string;
  model: string;
  version: string | null;
  modelYear: number | null;
  manufactureYear: number | null;
  status: string;
}

const COLUMN: Record<StatsEvent, 'views' | 'whatsapp_clicks'> = { view: 'views', whatsapp: 'whatsapp_clicks' };

/** Contadores anônimos por veículo e dia (tabela vehicle_daily_stats). */
export class StatsRepository {
  constructor(private readonly db: Database) {}

  /**
   * Soma 1 ao contador do dia — só para veículos visíveis no site (uma única consulta).
   * Retorna false quando o veículo não existe ou não está publicado.
   */
  async increment(vehicleId: string, day: string, event: StatsEvent): Promise<boolean> {
    const column = COLUMN[event];
    const result = await this.db.run(
      `INSERT INTO vehicle_daily_stats (vehicle_id, day, ${column})
       SELECT id, ?, 1 FROM vehicles
       WHERE id = ? AND deleted_at IS NULL AND published = 1 AND status IN ('available', 'reserved', 'sold')
       ON CONFLICT (vehicle_id, day) DO UPDATE SET ${column} = ${column} + 1`,
      [day, vehicleId],
    );
    return result.changes > 0;
  }

  async forVehicle(vehicleId: string, sinceDay: string): Promise<VehicleStats> {
    const row = await this.db.first<{ views: number | null; clicks: number | null }>(
      `SELECT SUM(views) AS views, SUM(whatsapp_clicks) AS clicks
       FROM vehicle_daily_stats WHERE vehicle_id = ? AND day >= ?`,
      [vehicleId, sinceDay],
    );
    return { views: Number(row?.views ?? 0), whatsappClicks: Number(row?.clicks ?? 0) };
  }

  async totals(sinceDay: string): Promise<VehicleStats> {
    const row = await this.db.first<{ views: number | null; clicks: number | null }>(
      'SELECT SUM(views) AS views, SUM(whatsapp_clicks) AS clicks FROM vehicle_daily_stats WHERE day >= ?',
      [sinceDay],
    );
    return { views: Number(row?.views ?? 0), whatsappClicks: Number(row?.clicks ?? 0) };
  }

  /** Veículos com mais interesse no período (cliques no WhatsApp, depois visualizações). */
  async top(sinceDay: string, limit: number): Promise<VehicleStatsRow[]> {
    const rows = await this.db.all<{
      vehicle_id: string;
      brand: string;
      model: string;
      version: string | null;
      model_year: number | null;
      manufacture_year: number | null;
      status: string;
      views: number;
      clicks: number;
    }>(
      `SELECT s.vehicle_id, v.brand, v.model, v.version, v.model_year, v.manufacture_year, v.status,
              SUM(s.views) AS views, SUM(s.whatsapp_clicks) AS clicks
       FROM vehicle_daily_stats s JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.day >= ? AND v.deleted_at IS NULL
       GROUP BY s.vehicle_id
       ORDER BY clicks DESC, views DESC
       LIMIT ?`,
      [sinceDay, limit],
    );
    return rows.map((r) => ({
      vehicleId: r.vehicle_id,
      brand: r.brand,
      model: r.model,
      version: r.version,
      modelYear: r.model_year,
      manufactureYear: r.manufacture_year,
      status: r.status,
      views: Number(r.views ?? 0),
      whatsappClicks: Number(r.clicks ?? 0),
    }));
  }
}
