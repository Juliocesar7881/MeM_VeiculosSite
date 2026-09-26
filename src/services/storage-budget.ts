import { StorageFullError } from '@/lib/errors';
import type { Database } from '@/lib/db/types';

/**
 * Teto do espaço de fotos: impede passar do armazenamento gratuito (no R2, sem teto, o excedente seria
 * cobrado no cartão). Conta os bytes registrados de cada foto (todas as versões) de veículos e propostas.
 */
export class StorageBudget {
  constructor(
    private readonly db: Database,
    /** `null` = sem teto (desenvolvimento, testes, S3 próprio). */
    readonly capBytes: number | null,
  ) {}

  async usedBytes(): Promise<number> {
    const row = await this.db.first<{ total: number }>(
      `SELECT (SELECT COALESCE(SUM(size_bytes), 0) FROM vehicle_images)
            + (SELECT COALESCE(SUM(size_bytes), 0) FROM vehicle_lead_images) AS total`,
    );
    return Number(row?.total ?? 0);
  }

  /** Lança StorageFullError se as novas fotos passariam do teto. */
  async ensureRoom(incomingBytes: number): Promise<void> {
    if (this.capBytes === null) return;
    if ((await this.usedBytes()) + incomingBytes > this.capBytes) throw new StorageFullError();
  }
}
