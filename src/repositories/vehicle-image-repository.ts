import type { Database, SqlStatement } from '@/lib/db/types';
import type { VehicleImage } from '@/types/domain';
import { mapVehicleImage, type ImageRow } from './mappers';

type Row = ImageRow & { vehicle_id: string };

export class VehicleImageRepository {
  constructor(private readonly db: Database) {}

  async listByVehicle(vehicleId: string): Promise<VehicleImage[]> {
    const rows = await this.db.all<Row>(
      'SELECT * FROM vehicle_images WHERE vehicle_id = ? ORDER BY position ASC, created_at ASC',
      [vehicleId],
    );
    return rows.map(mapVehicleImage);
  }

  async findById(id: string): Promise<VehicleImage | null> {
    const row = await this.db.first<Row>('SELECT * FROM vehicle_images WHERE id = ?', [id]);
    return row ? mapVehicleImage(row) : null;
  }

  async count(vehicleId: string): Promise<number> {
    const row = await this.db.first<{ total: number }>(
      'SELECT COUNT(*) AS total FROM vehicle_images WHERE vehicle_id = ?',
      [vehicleId],
    );
    return Number(row?.total ?? 0);
  }

  async nextPosition(vehicleId: string): Promise<number> {
    const row = await this.db.first<{ pos: number | null }>(
      'SELECT MAX(position) AS pos FROM vehicle_images WHERE vehicle_id = ?',
      [vehicleId],
    );
    return row?.pos === null || row?.pos === undefined ? 0 : Number(row.pos) + 1;
  }

  insertStatement(image: VehicleImage): SqlStatement {
    return {
      sql: `INSERT INTO vehicle_images
        (id, vehicle_id, large_key, thumb_key, width, height, thumb_width, thumb_height, content_type, size_bytes, position, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        image.id,
        image.vehicleId,
        image.largeKey,
        image.thumbKey,
        image.width,
        image.height,
        image.thumbWidth,
        image.thumbHeight,
        image.contentType,
        image.sizeBytes,
        image.position,
        image.createdAt,
      ],
    };
  }

  async insert(image: VehicleImage): Promise<void> {
    const stmt = this.insertStatement(image);
    await this.db.run(stmt.sql, stmt.args);
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM vehicle_images WHERE id = ?', [id]);
  }

  /** Reordena (a primeira foto é a capa). IDs de outro veículo são ignorados. */
  async reorder(vehicleId: string, orderedIds: string[]): Promise<void> {
    await this.db.batch(
      orderedIds.map((id, index) => ({
        sql: 'UPDATE vehicle_images SET position = ? WHERE id = ? AND vehicle_id = ?',
        args: [index, id, vehicleId],
      })),
    );
  }
}
