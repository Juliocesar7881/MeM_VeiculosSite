import type { AuditRepository } from '@/repositories/audit-repository';
import type { AdminActor } from '@/types/domain';

export class AuditService {
  constructor(
    private readonly repo: AuditRepository,
    private readonly idGen: () => string = () => crypto.randomUUID(),
  ) {}

  /** Registra uma ação administrativa. Falhas de log nunca interrompem a operação. */
  async log(
    actor: AdminActor | string,
    action: string,
    entityType: string,
    entityId: string | null,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.repo.insert({
        id: this.idGen(),
        actor: typeof actor === 'string' ? actor : actor.label,
        action,
        entityType,
        entityId,
        details: details ? JSON.stringify(details).slice(0, 2000) : null,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[audit] falha ao registrar ação', error);
    }
  }

  listForEntity(entityType: string, entityId: string) {
    return this.repo.listForEntity(entityType, entityId);
  }
}
