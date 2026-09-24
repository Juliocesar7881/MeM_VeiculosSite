import type { LeadStatus } from '@/config/catalog';
import { IMAGE_LIMITS, SITE_CONSTANTS } from '@/config/site';
import type { Database, SqlStatement } from '@/lib/db/types';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import { leadImageKey, vehicleImageKey } from '@/lib/storage/keys';
import type { ObjectStorage } from '@/lib/storage/types';
import type { LeadListFilters, LeadRepository } from '@/repositories/lead-repository';
import type { VehicleImageRepository } from '@/repositories/vehicle-image-repository';
import type { VehicleRepository } from '@/repositories/vehicle-repository';
import { LEAD_CONSENT_TEXT, type LeadInput } from '@/schemas/lead';
import type { AdminActor, LeadDetail, LeadImage, LeadListItem, Paginated, Vehicle, VehicleImage } from '@/types/domain';
import { buildVehicleSlug } from '@/utils/slug';
import type { AuditService } from './audit-service';
import { validateImagePair, type ImagePair } from './media-service';
import { buildSearchText } from './vehicle-service';

export interface LeadNotifier {
  notifyNewLead(lead: LeadDetail): Promise<void>;
}

export interface LeadServiceDeps {
  db: Database;
  leads: LeadRepository;
  vehicles: VehicleRepository;
  vehicleImages: VehicleImageRepository;
  storage: ObjectStorage;
  audit: AuditService;
  notifier?: LeadNotifier | null;
  now?: () => Date;
  idGen?: () => string;
}

export class LeadService {
  private readonly now: () => Date;
  private readonly idGen: () => string;

  constructor(private readonly deps: LeadServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.idGen = deps.idGen ?? (() => crypto.randomUUID());
  }

  /**
   * Recebe uma proposta do formulário "Anuncie seu veículo".
   * Nunca publica nada: cria apenas o registro da proposta + fotos em sell-leads/.
   */
  async submit(input: LeadInput, photos: ImagePair[], meta: { ipHash: string | null }): Promise<string> {
    if (photos.length > SITE_CONSTANTS.maxLeadPhotos) {
      throw new ValidationError(`Envie no máximo ${SITE_CONSTANTS.maxLeadPhotos} fotos.`);
    }
    const validated = photos.map((pair) =>
      validateImagePair(pair, {
        largeMaxBytes: IMAGE_LIMITS.leadLargeMaxBytes,
        thumbMaxBytes: IMAGE_LIMITS.leadThumbMaxBytes,
        largeMaxEdge: IMAGE_LIMITS.leadLargeMaxEdge,
        thumbMaxEdge: IMAGE_LIMITS.thumbMaxEdge,
      }),
    );

    const leadId = this.idGen();
    const nowIso = this.now().toISOString();
    const uploadedKeys: string[] = [];
    const images: LeadImage[] = [];

    try {
      for (const [index, pair] of photos.entries()) {
        const info = validated[index];
        if (!info) continue;
        const imageId = this.idGen();
        const largeKey = leadImageKey(leadId, imageId, 'large', info.large.extension);
        const thumbKey = leadImageKey(leadId, imageId, 'thumb', info.thumb.extension);
        await this.deps.storage.put(largeKey, pair.large, { contentType: info.large.contentType });
        uploadedKeys.push(largeKey);
        await this.deps.storage.put(thumbKey, pair.thumb, { contentType: info.thumb.contentType });
        uploadedKeys.push(thumbKey);
        images.push({
          id: imageId,
          leadId,
          largeKey,
          thumbKey,
          width: info.large.width,
          height: info.large.height,
          thumbWidth: info.thumb.width,
          thumbHeight: info.thumb.height,
          contentType: info.large.contentType,
          sizeBytes: info.large.size + info.thumb.size,
          position: index,
          createdAt: nowIso,
        });
      }

      await this.deps.leads.insertWithImages(
        {
          id: leadId,
          status: 'new',
          name: input.name,
          whatsapp: input.whatsapp,
          email: input.email,
          category: input.category,
          brand: input.brand,
          model: input.model,
          version: input.version,
          manufactureYear: input.manufactureYear,
          modelYear: input.modelYear,
          mileage: input.mileage,
          usageHours: input.usageHours,
          fuel: input.fuel,
          transmission: input.transmission,
          color: input.color,
          city: input.city,
          state: input.state,
          desiredPrice: input.desiredPrice,
          description: input.description,
          consentText: LEAD_CONSENT_TEXT,
          consentAt: nowIso,
          adminNotes: null,
          convertedVehicleId: null,
          createdAt: nowIso,
          updatedAt: nowIso,
          ipHash: meta.ipHash,
        },
        images,
      );
    } catch (error) {
      if (uploadedKeys.length) await this.deps.storage.delete(uploadedKeys).catch(() => undefined);
      throw error;
    }

    if (this.deps.notifier) {
      const detail = await this.getDetail(leadId);
      if (detail) {
        await this.deps.notifier
          .notifyNewLead(detail)
          .catch((error: unknown) => console.error('[lead] falha ao enviar notificação', error));
      }
    }
    return leadId;
  }

  async list(filters: LeadListFilters): Promise<Paginated<LeadListItem>> {
    const { items, total } = await this.deps.leads.list(filters);
    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    };
  }

  latest(limit = 6): Promise<LeadListItem[]> {
    return this.deps.leads.latest(limit);
  }

  countByStatus() {
    return this.deps.leads.countByStatus();
  }

  async getDetail(id: string): Promise<LeadDetail | null> {
    const lead = await this.deps.leads.findById(id);
    if (!lead) return null;
    const images = await this.deps.leads.listImages(id);
    return { ...lead, images };
  }

  async updateStatus(id: string, status: LeadStatus, actor: AdminActor): Promise<void> {
    const lead = await this.deps.leads.findById(id);
    if (!lead) throw new NotFoundError('Proposta não encontrada.');
    if (status === 'converted' && !lead.convertedVehicleId) {
      throw new ValidationError('Use "Transformar em veículo" para converter a proposta.');
    }
    await this.deps.leads.updateStatus(id, status, this.now().toISOString());
    await this.deps.audit.log(actor, 'lead.status', 'lead', id, { from: lead.status, to: status });
  }

  async updateNotes(id: string, notes: string | null, actor: AdminActor): Promise<void> {
    const ok = await this.deps.leads.updateNotes(id, notes, this.now().toISOString());
    if (!ok) throw new NotFoundError('Proposta não encontrada.');
    await this.deps.audit.log(actor, 'lead.notes', 'lead', id);
  }

  /** Exclusão definitiva (ex.: pedido do titular dos dados — LGPD). Remove também as fotos. */
  async delete(id: string, actor: AdminActor): Promise<void> {
    const detail = await this.getDetail(id);
    if (!detail) throw new NotFoundError('Proposta não encontrada.');
    await this.deps.leads.delete(id);
    const keys = detail.images.flatMap((i) => [i.largeKey, i.thumbKey]);
    if (keys.length) {
      await this.deps.storage.delete(keys).catch((error: unknown) => {
        console.error('[lead] falha ao remover fotos do storage', error);
      });
    }
    await this.deps.audit.log(actor, 'lead.delete', 'lead', id);
  }

  /**
   * Proposta -> Rascunho de veículo.
   * Reaproveita os dados e COPIA as fotos para vehicles/{id}/ (as originais da proposta
   * continuam separadas). O veículo nasce como rascunho não publicado, sem preço.
   */
  async convertToVehicle(id: string, actor: AdminActor): Promise<Vehicle> {
    const lead = await this.getDetail(id);
    if (!lead) throw new NotFoundError('Proposta não encontrada.');
    if (lead.convertedVehicleId) {
      const existing = await this.deps.vehicles.findById(lead.convertedVehicleId);
      if (existing) throw new ConflictError('Esta proposta já foi transformada em veículo.');
    }

    const nowIso = this.now().toISOString();
    const vehicleId = this.idGen();
    const vehicle: Vehicle = {
      id: vehicleId,
      slug: '',
      category: lead.category,
      brand: lead.brand,
      model: lead.model,
      version: lead.version,
      manufactureYear: lead.manufactureYear,
      modelYear: lead.modelYear,
      mileage: lead.mileage,
      usageHours: lead.usageHours,
      fuel: lead.fuel,
      transmission: lead.transmission,
      color: lead.color,
      bodyType: null,
      price: null,
      previousPrice: null,
      description: null,
      status: 'draft',
      featured: false,
      isOffer: false,
      commercialType: 'normal',
      offerStartAt: null,
      offerEndAt: null,
      published: false,
      city: lead.city,
      state: lead.state,
      sourceLeadId: lead.id,
      soldAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      publishedAt: null,
      deletedAt: null,
    };
    vehicle.slug = buildVehicleSlug(vehicle, vehicleId);
    if (await this.deps.vehicles.slugExists(vehicle.slug)) {
      vehicle.slug = buildVehicleSlug(vehicle, vehicleId, 12);
    }

    const copiedKeys: string[] = [];
    const images: VehicleImage[] = [];
    try {
      for (const [index, source] of lead.images.entries()) {
        const imageId = this.idGen();
        const largeKey = vehicleImageKey(vehicleId, imageId, 'large', extension(source.largeKey));
        const thumbKey = vehicleImageKey(vehicleId, imageId, 'thumb', extension(source.thumbKey));
        await this.deps.storage.copy(source.largeKey, largeKey);
        copiedKeys.push(largeKey);
        await this.deps.storage.copy(source.thumbKey, thumbKey);
        copiedKeys.push(thumbKey);
        images.push({
          id: imageId,
          vehicleId,
          largeKey,
          thumbKey,
          ogKey: null,
          width: source.width,
          height: source.height,
          thumbWidth: source.thumbWidth,
          thumbHeight: source.thumbHeight,
          contentType: source.contentType,
          sizeBytes: source.sizeBytes,
          position: index,
          createdAt: nowIso,
        });
      }

      const statements: SqlStatement[] = [
        this.deps.vehicles.insertStatement(vehicle, buildSearchText(vehicle)),
        ...images.map((image) => this.deps.vehicleImages.insertStatement(image)),
        this.deps.leads.markConvertedStatement(lead.id, vehicleId, nowIso),
      ];
      await this.deps.db.batch(statements);
    } catch (error) {
      if (copiedKeys.length) await this.deps.storage.delete(copiedKeys).catch(() => undefined);
      throw error;
    }

    await this.deps.audit.log(actor, 'lead.convert', 'lead', lead.id, { vehicleId });
    await this.deps.audit.log(actor, 'vehicle.create_from_lead', 'vehicle', vehicleId, { leadId: lead.id });
    return vehicle;
  }
}

function extension(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1);
}
