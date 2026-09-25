import type { LeadStatus } from '@/config/catalog';
import type { Database, SqlStatement, SqlValue } from '@/lib/db/types';
import type { LeadImage, LeadListItem, VehicleLead } from '@/types/domain';
import { likeContains, searchTerms } from '@/utils/text';
import { mapCover, mapLead, mapLeadImage, type CoverColumns, type ImageRow, type LeadRow } from './mappers';

export interface NewLeadRecord extends VehicleLead {
  ipHash: string | null;
}

export interface LeadListFilters {
  status?: LeadStatus;
  /** Por padrão oculta arquivadas/convertidas/recusadas ("abertas"). */
  scope?: 'open' | 'all';
  q?: string;
  page: number;
  pageSize: number;
}

const OPEN_STATUSES = "('new', 'reviewing', 'contacted', 'negotiating', 'accepted')";

export class LeadRepository {
  constructor(private readonly db: Database) {}

  async insertWithImages(lead: NewLeadRecord, images: LeadImage[]): Promise<void> {
    const statements: SqlStatement[] = [
      {
        sql: `INSERT INTO vehicle_leads
          (id, status, name, whatsapp, email, category, brand, model, version, manufacture_year, model_year,
           mileage, usage_hours, fuel, transmission, color, city, state, desired_price, description,
           consent_text, consent_at, ip_hash, admin_notes, converted_vehicle_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          lead.id,
          lead.status,
          lead.name,
          lead.whatsapp,
          lead.email,
          lead.category,
          lead.brand,
          lead.model,
          lead.version,
          lead.manufactureYear,
          lead.modelYear,
          lead.mileage,
          lead.usageHours,
          lead.fuel,
          lead.transmission,
          lead.color,
          lead.city,
          lead.state,
          lead.desiredPrice,
          lead.description,
          lead.consentText,
          lead.consentAt,
          lead.ipHash,
          lead.adminNotes,
          lead.convertedVehicleId,
          lead.createdAt,
          lead.updatedAt,
        ],
      },
      ...images.map((image) => ({
        sql: `INSERT INTO vehicle_lead_images
          (id, lead_id, large_key, thumb_key, width, height, thumb_width, thumb_height, content_type, size_bytes, position, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          image.id,
          image.leadId,
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
        ] as SqlValue[],
      })),
    ];
    await this.db.batch(statements);
  }

  async findById(id: string): Promise<VehicleLead | null> {
    const row = await this.db.first<LeadRow>('SELECT * FROM vehicle_leads WHERE id = ?', [id]);
    return row ? mapLead(row) : null;
  }

  async listImages(leadId: string): Promise<LeadImage[]> {
    const rows = await this.db.all<ImageRow & { lead_id: string }>(
      'SELECT * FROM vehicle_lead_images WHERE lead_id = ? ORDER BY position ASC',
      [leadId],
    );
    return rows.map(mapLeadImage);
  }

  async list(filters: LeadListFilters): Promise<{ items: LeadListItem[]; total: number }> {
    const clauses: string[] = [];
    const args: SqlValue[] = [];
    if (filters.status) {
      clauses.push('l.status = ?');
      args.push(filters.status);
    } else if (filters.scope !== 'all') {
      clauses.push(`l.status IN ${OPEN_STATUSES}`);
    }
    if (filters.q) {
      for (const term of searchTerms(filters.q)) {
        clauses.push(
          `(lower(l.name) LIKE ? ESCAPE '\\' OR lower(l.brand || ' ' || l.model) LIKE ? ESCAPE '\\' OR l.whatsapp LIKE ? ESCAPE '\\')`,
        );
        const like = likeContains(term);
        args.push(like, like, like);
      }
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const count = await this.db.first<{ total: number }>(
      `SELECT COUNT(*) AS total FROM vehicle_leads l ${where}`,
      args,
    );
    const rows = await this.db.all<LeadRow & CoverColumns>(
      `SELECT l.*,
         ci.large_key AS cover_large_key, ci.thumb_key AS cover_thumb_key,
         ci.width AS cover_width, ci.height AS cover_height,
         ci.thumb_width AS cover_thumb_width, ci.thumb_height AS cover_thumb_height,
         (SELECT COUNT(*) FROM vehicle_lead_images x WHERE x.lead_id = l.id) AS image_count
       FROM vehicle_leads l
       LEFT JOIN vehicle_lead_images ci ON ci.id = (
         SELECT id FROM vehicle_lead_images WHERE lead_id = l.id ORDER BY position ASC LIMIT 1
       )
       ${where}
       ORDER BY CASE WHEN l.status = 'new' THEN 0 ELSE 1 END, l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...args, filters.pageSize, (Math.max(1, filters.page) - 1) * filters.pageSize],
    );
    return {
      items: rows.map((row) => ({
        ...mapLead(row),
        cover: mapCover(row),
        imageCount: Number(row.image_count ?? 0),
      })),
      total: Number(count?.total ?? 0),
    };
  }

  async countByStatus(): Promise<Record<LeadStatus, number>> {
    const rows = await this.db.all<{ status: LeadStatus; count: number }>(
      'SELECT status, COUNT(*) AS count FROM vehicle_leads GROUP BY status',
    );
    const result: Record<LeadStatus, number> = {
      new: 0,
      reviewing: 0,
      contacted: 0,
      negotiating: 0,
      accepted: 0,
      rejected: 0,
      converted: 0,
      archived: 0,
    };
    for (const row of rows) result[row.status] = Number(row.count);
    return result;
  }

  async updateStatus(id: string, status: LeadStatus, updatedAt: string): Promise<boolean> {
    const res = await this.db.run('UPDATE vehicle_leads SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      updatedAt,
      id,
    ]);
    return res.changes > 0;
  }

  async updateNotes(id: string, notes: string | null, updatedAt: string): Promise<boolean> {
    const res = await this.db.run('UPDATE vehicle_leads SET admin_notes = ?, updated_at = ? WHERE id = ?', [
      notes,
      updatedAt,
      id,
    ]);
    return res.changes > 0;
  }

  markConvertedStatement(id: string, vehicleId: string, updatedAt: string): SqlStatement {
    return {
      sql: "UPDATE vehicle_leads SET status = 'converted', converted_vehicle_id = ?, updated_at = ? WHERE id = ?",
      args: [vehicleId, updatedAt, id],
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.batch([
      { sql: 'DELETE FROM vehicle_lead_images WHERE lead_id = ?', args: [id] },
      { sql: 'DELETE FROM vehicle_leads WHERE id = ?', args: [id] },
    ]);
  }

  async latest(limit: number): Promise<LeadListItem[]> {
    const { items } = await this.list({ scope: 'all', page: 1, pageSize: limit });
    return items;
  }
}
