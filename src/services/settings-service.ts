import { SITE_SETTINGS } from '@/config/site';
import type { SettingsRepository } from '@/repositories/settings-repository';
import type { AdminActor } from '@/types/domain';
import type { SiteSettings } from '@/types/settings';
import type { AuditService } from './audit-service';

/**
 * Dados institucionais (contatos, redes, textos), definidos em `config/site.ts`,
 * e o corte de sessões do painel (gravado no banco pelo "Sair").
 */
export class SettingsService {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<SiteSettings> {
    return SITE_SETTINGS;
  }

  /** Corte de sessões do painel (sem cache: vale na hora em todas as instâncias). */
  sessionsValidAfter(): Promise<number> {
    return this.repo.getSessionsValidAfter();
  }

  /** "Sair": invalida no servidor todas as sessões emitidas até agora (inclusive cookies copiados). */
  async revokeAdminSessions(actor: AdminActor): Promise<void> {
    const now = new Date();
    // Em segundos com milissegundos: vale também para sessões criadas no mesmo segundo.
    await this.repo.setSessionsValidAfter(now.getTime() / 1000, now.toISOString());
    await this.audit.log(actor, 'auth.revoke_sessions', 'session', null);
  }
}
