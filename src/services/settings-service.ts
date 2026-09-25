import { DEFAULT_SETTINGS } from '@/config/site';
import type { SettingsRepository } from '@/repositories/settings-repository';
import type { SettingsInput } from '@/schemas/settings';
import type { AdminActor } from '@/types/domain';
import type { SiteSettings } from '@/types/settings';
import type { AuditService } from './audit-service';

const CACHE_TTL_MS = 30_000;

/**
 * Configurações institucionais (contatos, redes, textos).
 * Cache em memória por instância (30 s) para economizar leituras do banco.
 */
export class SettingsService {
  private cache: { value: SiteSettings; expiresAt: number } | null = null;

  constructor(
    private readonly repo: SettingsRepository,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<SiteSettings> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.value;
    try {
      const value = await this.repo.getAll(DEFAULT_SETTINGS);
      this.cache = { value, expiresAt: now + CACHE_TTL_MS };
      return value;
    } catch (error) {
      console.error('[settings] falha ao ler configurações; usando padrão', error);
      return this.cache?.value ?? DEFAULT_SETTINGS;
    }
  }

  async update(input: SettingsInput, actor: AdminActor): Promise<SiteSettings> {
    const value: SiteSettings = { ...input };
    await this.repo.saveAll(value, new Date().toISOString());
    this.cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    await this.audit.log(actor, 'settings.update', 'settings', null);
    return value;
  }

  invalidate(): void {
    this.cache = null;
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
