import { CATEGORY_INFO, FUEL_LABELS, TRANSMISSION_LABELS } from '@/config/catalog';
import { SITE_CONSTANTS } from '@/config/site';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { ObjectStorage } from '@/lib/storage/types';
import type { VehicleImageRepository } from '@/repositories/vehicle-image-repository';
import type {
  AdminVehicleFilters,
  InventoryFacets,
  VehicleRepository,
  VehicleStats,
} from '@/repositories/vehicle-repository';
import type { InventoryFilters } from '@/schemas/filters';
import type { VehicleInput, VehicleQuickAction } from '@/schemas/vehicle';
import type { AdminActor, Paginated, Vehicle, VehicleCard, VehicleDetail } from '@/types/domain';
import type { SiteSettings } from '@/types/settings';
import { localDateEndToIso, localDateStartToIso } from '@/utils/dates';
import { buildVehicleSlug } from '@/utils/slug';
import { normalizeSearch } from '@/utils/text';
import type { AuditService } from './audit-service';
import { storedKeys } from './media-service';

export interface VehicleServiceDeps {
  vehicles: VehicleRepository;
  images: VehicleImageRepository;
  storage: ObjectStorage;
  audit: AuditService;
  now?: () => Date;
  idGen?: () => string;
}

export type PublicVehicleResult =
  { kind: 'ok'; vehicle: VehicleDetail } | { kind: 'redirect'; slug: string } | { kind: 'not-found' };

export interface HomeSections {
  featured: VehicleCard[];
  offers: VehicleCard[];
  repasses: VehicleCard[];
  latest: VehicleCard[];
  offersTotal: number;
  repassesTotal: number;
}

export function buildSearchText(
  v: Pick<
    Vehicle,
    | 'brand'
    | 'model'
    | 'version'
    | 'bodyType'
    | 'color'
    | 'category'
    | 'fuel'
    | 'transmission'
    | 'manufactureYear'
    | 'modelYear'
  >,
): string {
  return normalizeSearch(
    [
      v.brand,
      v.model,
      v.version ?? '',
      v.bodyType ?? '',
      v.color ?? '',
      CATEGORY_INFO[v.category].label,
      v.fuel ? FUEL_LABELS[v.fuel] : '',
      v.transmission ? TRANSMISSION_LABELS[v.transmission] : '',
      v.manufactureYear ?? '',
      v.modelYear ?? '',
    ].join(' '),
  );
}

export class VehicleService {
  private readonly now: () => Date;
  private readonly idGen: () => string;

  constructor(private readonly deps: VehicleServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.idGen = deps.idGen ?? (() => crypto.randomUUID());
  }

  // ---------------------------------------------------------------------------
  // Regras de montagem
  // ---------------------------------------------------------------------------

  /** Aplica os dados do formulário a um veículo (novo ou existente), com as regras de negócio. */
  private applyInput(base: Vehicle | null, input: VehicleInput, id: string, nowIso: string): Vehicle {
    let status = input.status;
    // Publicar um rascunho o torna disponível automaticamente.
    if (input.published && status === 'draft') status = 'available';
    const published = input.published && status !== 'archived';

    const wasSold = base?.status === 'sold';
    const soldAt = status === 'sold' ? (wasSold ? (base?.soldAt ?? nowIso) : nowIso) : null;

    return {
      id,
      slug: base?.slug ?? '',
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
      bodyType: input.bodyType,
      price: input.price,
      previousPrice: input.previousPrice,
      description: input.description,
      status,
      featured: input.featured,
      isOffer: input.isOffer,
      commercialType: input.commercialType,
      offerStartAt: input.offerStartDate ? localDateStartToIso(input.offerStartDate) : null,
      offerEndAt: input.offerEndDate ? localDateEndToIso(input.offerEndDate) : null,
      published,
      city: input.city,
      state: input.state,
      sourceLeadId: base?.sourceLeadId ?? null,
      soldAt,
      createdAt: base?.createdAt ?? nowIso,
      updatedAt: nowIso,
      publishedAt: published ? (base?.publishedAt ?? nowIso) : (base?.publishedAt ?? null),
      deletedAt: null,
    };
  }

  private async uniqueSlug(vehicle: Vehicle): Promise<string> {
    for (const length of [6, 8, 12, 32]) {
      const slug = buildVehicleSlug(vehicle, vehicle.id, length);
      if (!(await this.deps.vehicles.slugExists(slug, vehicle.id))) return slug;
    }
    return `veiculo-${vehicle.id}`;
  }

  // ---------------------------------------------------------------------------
  // Escrita (admin)
  // ---------------------------------------------------------------------------

  async create(input: VehicleInput, actor: AdminActor, sourceLeadId: string | null = null): Promise<Vehicle> {
    const nowIso = this.now().toISOString();
    const vehicle = this.applyInput(null, input, this.idGen(), nowIso);
    vehicle.sourceLeadId = sourceLeadId;
    vehicle.slug = await this.uniqueSlug(vehicle);
    await this.deps.vehicles.insert(vehicle, buildSearchText(vehicle), input.features);
    await this.deps.audit.log(actor, 'vehicle.create', 'vehicle', vehicle.id, {
      name: `${vehicle.brand} ${vehicle.model}`,
      status: vehicle.status,
    });
    return vehicle;
  }

  async update(id: string, input: VehicleInput, actor: AdminActor): Promise<Vehicle> {
    const current = await this.deps.vehicles.findById(id);
    if (!current) throw new NotFoundError('Veículo não encontrado.');
    const nowIso = this.now().toISOString();
    const next = this.applyInput(current, input, id, nowIso);

    const identityChanged =
      current.brand !== next.brand ||
      current.model !== next.model ||
      (current.version ?? '') !== (next.version ?? '') ||
      current.modelYear !== next.modelYear ||
      current.manufactureYear !== next.manufactureYear;
    next.slug = identityChanged ? await this.uniqueSlug(next) : current.slug;

    await this.deps.vehicles.update(next, buildSearchText(next), input.features, identityChanged ? current.slug : null);
    await this.deps.audit.log(actor, 'vehicle.update', 'vehicle', id, {
      status: next.status,
      published: next.published,
      featured: next.featured,
      isOffer: next.isOffer,
      commercialType: next.commercialType,
    });
    return next;
  }

  /** Ações rápidas da listagem do admin (publicar, vender, destacar, oferta, repasse...). */
  async quickAction(id: string, action: VehicleQuickAction, actor: AdminActor): Promise<Vehicle> {
    const current = await this.deps.vehicles.findById(id);
    if (!current) throw new NotFoundError('Veículo não encontrado.');
    if (action === 'delete') {
      await this.softDelete(current, actor);
      return current;
    }

    const nowIso = this.now().toISOString();
    const next: Vehicle = { ...current, updatedAt: nowIso };

    switch (action) {
      case 'publish':
        if (next.status === 'archived') {
          throw new ValidationError('Desarquive o veículo (altere o status) antes de publicar.');
        }
        if (next.status === 'draft') next.status = 'available';
        next.published = true;
        next.publishedAt = next.publishedAt ?? nowIso;
        break;
      case 'unpublish':
        next.published = false;
        break;
      case 'mark-available':
        next.status = 'available';
        next.soldAt = null;
        break;
      case 'mark-reserved':
        next.status = 'reserved';
        next.soldAt = null;
        break;
      case 'mark-sold':
        next.status = 'sold';
        next.soldAt = current.soldAt ?? nowIso;
        next.featured = false;
        break;
      case 'archive':
        next.status = 'archived';
        next.published = false;
        next.featured = false;
        break;
      case 'feature':
        next.featured = true;
        break;
      case 'unfeature':
        next.featured = false;
        break;
      case 'offer-on':
        next.isOffer = true;
        break;
      case 'offer-off':
        next.isOffer = false;
        break;
      case 'repasse-on':
        next.commercialType = 'repasse';
        break;
      case 'repasse-off':
        next.commercialType = 'normal';
        break;
      default: {
        const exhaustive: never = action;
        throw new ValidationError(`Ação inválida: ${String(exhaustive)}`);
      }
    }

    await this.deps.vehicles.update(next, buildSearchText(next), null, null);
    await this.deps.audit.log(actor, `vehicle.${action}`, 'vehicle', id);
    return next;
  }

  /**
   * Exclusão: o registro permanece (histórico/auditoria) com deleted_at preenchido,
   * mas sai do site e as fotos são removidas do storage para liberar espaço.
   */
  private async softDelete(vehicle: Vehicle, actor: AdminActor): Promise<void> {
    const nowIso = this.now().toISOString();
    const images = await this.deps.images.listByVehicle(vehicle.id);
    const deleted: Vehicle = {
      ...vehicle,
      published: false,
      featured: false,
      deletedAt: nowIso,
      updatedAt: nowIso,
    };
    await this.deps.vehicles.update(deleted, buildSearchText(deleted), null, null);
    for (const image of images) await this.deps.images.delete(image.id);
    if (images.length) {
      await this.deps.storage
        .delete(images.flatMap(storedKeys))
        .catch((error: unknown) => console.error('[vehicle] falha ao remover fotos do storage', error));
    }
    await this.deps.audit.log(actor, 'vehicle.delete', 'vehicle', vehicle.id, {
      name: `${vehicle.brand} ${vehicle.model}`,
    });
  }

  // ---------------------------------------------------------------------------
  // Leitura
  // ---------------------------------------------------------------------------

  async getDetail(id: string): Promise<VehicleDetail | null> {
    const vehicle = await this.deps.vehicles.findById(id);
    if (!vehicle) return null;
    const [images, features] = await Promise.all([
      this.deps.images.listByVehicle(id),
      this.deps.vehicles.getFeatures(id),
    ]);
    return { ...vehicle, images, features };
  }

  /**
   * Página pública do veículo.
   * - Rascunho, arquivado, despublicado ou excluído: 404.
   * - Vendido: continua acessível (mostra "Vendido" + "Procurando algo parecido?"),
   *   mesmo que a listagem de vendidos esteja desativada — links compartilhados não quebram.
   * - Slug antigo: redireciona para o atual.
   */
  async getPublicBySlug(slug: string): Promise<PublicVehicleResult> {
    const vehicle = await this.deps.vehicles.findBySlug(slug);
    if (!vehicle) {
      const current = await this.deps.vehicles.findCurrentSlugByHistory(slug);
      return current ? { kind: 'redirect', slug: current } : { kind: 'not-found' };
    }
    const visible = vehicle.published && ['available', 'reserved', 'sold'].includes(vehicle.status);
    if (!visible) return { kind: 'not-found' };
    const [images, features] = await Promise.all([
      this.deps.images.listByVehicle(vehicle.id),
      this.deps.vehicles.getFeatures(vehicle.id),
    ]);
    return { kind: 'ok', vehicle: { ...vehicle, images, features } };
  }

  async search(
    filters: InventoryFilters,
    settings: SiteSettings,
    pageSize: number = SITE_CONSTANTS.inventoryPageSize,
  ): Promise<Paginated<VehicleCard>> {
    const { items, total } = await this.deps.vehicles.searchPublic(filters, {
      now: this.now(),
      showSold: settings.showSoldVehicles,
      pageSize,
    });
    return {
      items,
      total,
      page: filters.page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  facets(filters: InventoryFilters, settings: SiteSettings): Promise<InventoryFacets> {
    return this.deps.vehicles.facets(filters, { now: this.now(), showSold: settings.showSoldVehicles });
  }

  async homeSections(limit: number = SITE_CONSTANTS.homeSectionSize): Promise<HomeSections> {
    const now = this.now();
    // Tudo em paralelo (uma única "rodada" de consultas ao banco).
    const [featured, offers, repasses, offersTotal, repassesTotal, recent] = await Promise.all([
      this.deps.vehicles.listSection('featured', { now, limit }),
      this.deps.vehicles.listSection('offers', { now, limit: 6 }),
      this.deps.vehicles.listSection('repasses', { now, limit: 4 }),
      this.deps.vehicles.countSection('offers', now),
      this.deps.vehicles.countSection('repasses', now),
      this.deps.vehicles.listSection('latest', { now, limit }),
    ]);
    // Sem destaques definidos: mostra os mais recentes para a Home não ficar vazia.
    const latest = featured.length > 0 ? [] : recent;
    return { featured, offers, repasses, latest, offersTotal, repassesTotal };
  }

  listSimilar(vehicle: Vehicle, limit = 4): Promise<VehicleCard[]> {
    return this.deps.vehicles.listSimilar(vehicle, limit);
  }

  listPublicByIds(ids: string[], settings: SiteSettings): Promise<VehicleCard[]> {
    return this.deps.vehicles.listPublicByIds(ids.slice(0, 60), settings.showSoldVehicles);
  }

  searchSuggestions(): Promise<string[]> {
    return this.deps.vehicles.searchSuggestions();
  }

  countByCategory() {
    return this.deps.vehicles.countPublicByCategory();
  }

  listForSitemap(settings: SiteSettings) {
    return this.deps.vehicles.listForSitemap(settings.showSoldVehicles);
  }

  async listAdmin(filters: AdminVehicleFilters): Promise<Paginated<VehicleCard>> {
    const { items, total } = await this.deps.vehicles.listAdmin(filters);
    return {
      items,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    };
  }

  stats(): Promise<VehicleStats> {
    return this.deps.vehicles.stats(this.now());
  }

  distinctBrands(): Promise<string[]> {
    return this.deps.vehicles.distinctBrands();
  }
}
