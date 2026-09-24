import type { StatsEvent, StatsRepository, VehicleStats, VehicleStatsRow } from '@/repositories/stats-repository';
import { isoToLocalDate } from '@/utils/dates';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const STATS_PERIOD_DAYS = 30;

export interface StatsOverview extends VehicleStats {
  top: VehicleStatsRow[];
}

/**
 * Métricas anônimas do site: visualizações da página do veículo e cliques no WhatsApp.
 * Sem cookies e sem dados do visitante — apenas contadores diários por veículo.
 */
export class StatsService {
  private readonly now: () => Date;

  constructor(
    private readonly repo: StatsRepository,
    now?: () => Date,
  ) {
    this.now = now ?? (() => new Date());
  }

  /** Registra um evento. Ignora (false) IDs inválidos e veículos que não estão no site. */
  async record(vehicleId: string, event: StatsEvent): Promise<boolean> {
    if (!UUID.test(vehicleId)) return false;
    return this.repo.increment(vehicleId, isoToLocalDate(this.now().toISOString()), event);
  }

  private sinceDay(days = STATS_PERIOD_DAYS): string {
    return isoToLocalDate(new Date(this.now().getTime() - (days - 1) * DAY_MS).toISOString());
  }

  forVehicle(vehicleId: string): Promise<VehicleStats> {
    return this.repo.forVehicle(vehicleId, this.sinceDay());
  }

  async overview(limit = 5): Promise<StatsOverview> {
    const since = this.sinceDay();
    const [totals, top] = await Promise.all([this.repo.totals(since), this.repo.top(since, limit)]);
    return { ...totals, top };
  }
}
