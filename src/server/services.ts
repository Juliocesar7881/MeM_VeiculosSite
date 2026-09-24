import type { Database } from '@/lib/db/types';
import type { ObjectStorage } from '@/lib/storage/types';
import { AuditRepository } from '@/repositories/audit-repository';
import { LeadRepository } from '@/repositories/lead-repository';
import { RateLimitRepository } from '@/repositories/rate-limit-repository';
import { SettingsRepository } from '@/repositories/settings-repository';
import { VehicleImageRepository } from '@/repositories/vehicle-image-repository';
import { VehicleRepository } from '@/repositories/vehicle-repository';
import { AuditService } from '@/services/audit-service';
import { LeadService, type LeadNotifier } from '@/services/lead-service';
import { MediaService } from '@/services/media-service';
import { RateLimiter } from '@/services/rate-limiter';
import { SettingsService } from '@/services/settings-service';
import { VehicleService } from '@/services/vehicle-service';

/**
 * Composição dos serviços (injeção manual de dependências), sem nenhuma dependência
 * do Astro — reutilizada pelo site, pelos scripts (seed/backup) e pelos testes.
 */
export interface Services {
  db: Database;
  storage: ObjectStorage;
  audit: AuditService;
  settings: SettingsService;
  vehicles: VehicleService;
  media: MediaService;
  leads: LeadService;
  rateLimiter: RateLimiter;
}

export function buildServices(options: {
  db: Database;
  storage: ObjectStorage;
  ipHashSalt: string;
  notifier?: LeadNotifier | null;
}): Services {
  const { db, storage } = options;
  const vehicleRepo = new VehicleRepository(db);
  const imageRepo = new VehicleImageRepository(db);
  const leadRepo = new LeadRepository(db);
  const audit = new AuditService(new AuditRepository(db));

  return {
    db,
    storage,
    audit,
    settings: new SettingsService(new SettingsRepository(db), audit),
    vehicles: new VehicleService({ vehicles: vehicleRepo, images: imageRepo, storage, audit }),
    media: new MediaService({ storage, vehicles: vehicleRepo, images: imageRepo, audit }),
    leads: new LeadService({
      db,
      leads: leadRepo,
      vehicles: vehicleRepo,
      vehicleImages: imageRepo,
      storage,
      audit,
      notifier: options.notifier ?? null,
    }),
    rateLimiter: new RateLimiter(new RateLimitRepository(db), options.ipHashSalt),
  };
}
