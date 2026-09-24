import type { Database } from '@/lib/db/types';
import type { AuditEntry } from '@/types/domain';

export class AuditRepository {
  constructor(private readonly db: Database) {}

  async insert(entry: AuditEntry): Promise<void> {
    await this.db.run(
      `INSERT INTO admin_audit_log (id, actor, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.actor, entry.action, entry.entityType, entry.entityId, entry.details, entry.createdAt],
    );
  }

  async listForEntity(entityType: string, entityId: string, limit = 30): Promise<AuditEntry[]> {
    const rows = await this.db.all<{
      id: string;
      actor: string;
      action: string;
      entity_type: string;
      entity_id: string | null;
      details: string | null;
      created_at: string;
    }>(
      `SELECT * FROM admin_audit_log WHERE entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [entityType, entityId, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      details: r.details,
      createdAt: r.created_at,
    }));
  }

  /** Mantém o log enxuto (free tier): remove registros antigos. */
  async purgeOlderThan(iso: string): Promise<void> {
    await this.db.run('DELETE FROM admin_audit_log WHERE created_at < ?', [iso]);
  }
}
