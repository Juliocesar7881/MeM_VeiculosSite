import type { VehicleCategory, VehicleStatus } from '@/config/catalog';
import { bool, type Database, type SqlStatement, type SqlValue } from '@/lib/db/types';
import type { InventoryFilters } from '@/schemas/filters';
import type { Vehicle, VehicleCard } from '@/types/domain';
import { reaisToCents } from '@/utils/money';
import { escapeLike, searchTerms } from '@/utils/text';
import { mapVehicle, mapVehicleCard, type VehicleCardRow, type VehicleRow } from './mappers';

const CARD_SELECT = `
  SELECT v.*,
    ci.large_key AS cover_large_key,
    ci.thumb_key AS cover_thumb_key,
    ci.width AS cover_width,
    ci.height AS cover_height,
    ci.thumb_width AS cover_thumb_width,
    ci.thumb_height AS cover_thumb_height,
    ci.medium_key AS cover_medium_key,
    ci.medium_width AS cover_medium_width,
    (SELECT COUNT(*) FROM vehicle_images x WHERE x.vehicle_id = v.id) AS image_count
  FROM vehicles v
  LEFT JOIN vehicle_images ci ON ci.id = (
    SELECT id FROM vehicle_images WHERE vehicle_id = v.id ORDER BY position ASC, created_at ASC LIMIT 1
  )`;

interface Where {
  clauses: string[];
  args: SqlValue[];
}

/** Condição de "oferta ativa" em SQL (espelha utils/offer.ts). */
function offerActiveSql(alias = 'v'): string {
  return `(${alias}.is_offer = 1 AND (${alias}.offer_start_at IS NULL OR ${alias}.offer_start_at <= ?) AND (${alias}.offer_end_at IS NULL OR ${alias}.offer_end_at > ?))`;
}

function publicVisibility(where: Where, showSold: boolean, includeSold = true) {
  const statuses = showSold && includeSold ? "('available', 'reserved', 'sold')" : "('available', 'reserved')";
  where.clauses.push(`v.deleted_at IS NULL AND v.published = 1 AND v.status IN ${statuses}`);
}

function applyInventoryFilters(where: Where, filters: InventoryFilters, nowIso: string) {
  if (filters.q) {
    for (const term of searchTerms(filters.q)) {
      where.clauses.push(`v.search_text LIKE ? ESCAPE '\\'`);
      where.args.push(`%${escapeLike(term)}%`);
    }
  }
  if (filters.category) {
    where.clauses.push('v.category = ?');
    where.args.push(filters.category);
  }
  if (filters.brand) {
    where.clauses.push('v.brand = ? COLLATE NOCASE');
    where.args.push(filters.brand);
  }
  if (filters.model) {
    where.clauses.push('v.model = ? COLLATE NOCASE');
    where.args.push(filters.model);
  }
  if (filters.yearMin) {
    where.clauses.push('COALESCE(v.model_year, v.manufacture_year) >= ?');
    where.args.push(filters.yearMin);
  }
  if (filters.yearMax) {
    where.clauses.push('COALESCE(v.model_year, v.manufacture_year) <= ?');
    where.args.push(filters.yearMax);
  }
  if (filters.priceMin) {
    where.clauses.push('v.price >= ?');
    where.args.push(reaisToCents(filters.priceMin));
  }
  if (filters.priceMax) {
    where.clauses.push('v.price <= ?');
    where.args.push(reaisToCents(filters.priceMax));
  }
  if (filters.fuel) {
    where.clauses.push('v.fuel = ?');
    where.args.push(filters.fuel);
  }
  if (filters.transmission) {
    where.clauses.push('v.transmission = ?');
    where.args.push(filters.transmission);
  }
  if (filters.repasseOnly) {
    where.clauses.push("v.commercial_type = 'repasse'");
  } else if (filters.commercialType) {
    where.clauses.push('v.commercial_type = ?');
    where.args.push(filters.commercialType);
  }
  if (filters.status) {
    where.clauses.push('v.status = ?');
    where.args.push(filters.status);
  }
  if (filters.offersOnly) {
    where.clauses.push(offerActiveSql());
    where.args.push(nowIso, nowIso);
  }
}

function orderBy(sort: InventoryFilters['sort']): string {
  const soldLast = "CASE WHEN v.status = 'sold' THEN 1 ELSE 0 END";
  switch (sort) {
    case 'menor-preco':
      return `${soldLast}, v.price IS NULL, v.price ASC, v.id`;
    case 'maior-preco':
      return `${soldLast}, v.price IS NULL, v.price DESC, v.id`;
    case 'menor-km':
      return `${soldLast}, v.mileage IS NULL, v.mileage ASC, v.id`;
    case 'maior-km':
      return `${soldLast}, v.mileage IS NULL, v.mileage DESC, v.id`;
    default:
      return `${soldLast}, COALESCE(v.published_at, v.created_at) DESC, v.id`;
  }
}

function whereSql(where: Where): string {
  return where.clauses.length ? `WHERE ${where.clauses.join(' AND ')}` : '';
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface InventoryFacets {
  categories: FacetCount[];
  brands: FacetCount[];
  models: FacetCount[];
  yearRange: { min: number | null; max: number | null };
  priceRange: { min: number | null; max: number | null };
}

export interface AdminVehicleFilters {
  q?: string;
  status?: VehicleStatus;
  offersOnly?: boolean;
  repasseOnly?: boolean;
  featuredOnly?: boolean;
  unpublishedOnly?: boolean;
  page: number;
  pageSize: number;
}

export interface VehicleStats {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  drafts: number;
  archived: number;
  repasses: number;
  offers: number;
  featured: number;
}

const VEHICLE_COLUMNS = [
  'id',
  'slug',
  'category',
  'brand',
  'model',
  'version',
  'manufacture_year',
  'model_year',
  'mileage',
  'usage_hours',
  'fuel',
  'transmission',
  'color',
  'body_type',
  'price',
  'previous_price',
  'description',
  'status',
  'featured',
  'is_offer',
  'commercial_type',
  'offer_start_at',
  'offer_end_at',
  'published',
  'city',
  'state',
  'search_text',
  'source_lead_id',
  'sold_at',
  'created_at',
  'updated_at',
  'published_at',
  'deleted_at',
] as const;

function vehicleValues(v: Vehicle, searchText: string): SqlValue[] {
  return [
    v.id,
    v.slug,
    v.category,
    v.brand,
    v.model,
    v.version,
    v.manufactureYear,
    v.modelYear,
    v.mileage,
    v.usageHours,
    v.fuel,
    v.transmission,
    v.color,
    v.bodyType,
    v.price,
    v.previousPrice,
    v.description,
    v.status,
    bool(v.featured),
    bool(v.isOffer),
    v.commercialType,
    v.offerStartAt,
    v.offerEndAt,
    bool(v.published),
    v.city,
    v.state,
    searchText,
    v.sourceLeadId,
    v.soldAt,
    v.createdAt,
    v.updatedAt,
    v.publishedAt,
    v.deletedAt,
  ];
}

export class VehicleRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string, includeDeleted = false): Promise<Vehicle | null> {
    const row = await this.db.first<VehicleRow>(
      `SELECT * FROM vehicles WHERE id = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
      [id],
    );
    return row ? mapVehicle(row) : null;
  }

  /** Veículo publicado e não excluído (qualquer status): suas fotos podem ser servidas a todos. */
  async isPublished(id: string): Promise<boolean> {
    const row = await this.db.first<{ ok: number }>(
      'SELECT 1 AS ok FROM vehicles WHERE id = ? AND deleted_at IS NULL AND published = 1',
      [id],
    );
    return Boolean(row);
  }

  async findBySlug(slug: string): Promise<Vehicle | null> {
    const row = await this.db.first<VehicleRow>('SELECT * FROM vehicles WHERE slug = ? AND deleted_at IS NULL', [slug]);
    return row ? mapVehicle(row) : null;
  }

  /** Slug antigo -> slug atual (para redirecionamento 301). */
  async findCurrentSlugByHistory(oldSlug: string): Promise<string | null> {
    const row = await this.db.first<{ slug: string }>(
      `SELECT v.slug FROM vehicle_slug_history h
       JOIN vehicles v ON v.id = h.vehicle_id
       WHERE h.slug = ? AND v.deleted_at IS NULL`,
      [oldSlug],
    );
    return row?.slug ?? null;
  }

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const row = await this.db.first<{ id: string }>(
      `SELECT id FROM vehicles WHERE slug = ? ${exceptId ? 'AND id <> ?' : ''}
       UNION ALL
       SELECT vehicle_id AS id FROM vehicle_slug_history WHERE slug = ? ${exceptId ? 'AND vehicle_id <> ?' : ''}
       LIMIT 1`,
      exceptId ? [slug, exceptId, slug, exceptId] : [slug, slug],
    );
    return row !== null;
  }

  async getFeatures(vehicleId: string): Promise<string[]> {
    const rows = await this.db.all<{ feature: string }>(
      'SELECT feature FROM vehicle_features WHERE vehicle_id = ? ORDER BY position, feature',
      [vehicleId],
    );
    return rows.map((r) => r.feature);
  }

  private featureStatements(vehicleId: string, features: string[]): SqlStatement[] {
    return [
      { sql: 'DELETE FROM vehicle_features WHERE vehicle_id = ?', args: [vehicleId] },
      ...features.map((feature, index) => ({
        sql: 'INSERT INTO vehicle_features (vehicle_id, feature, position) VALUES (?, ?, ?)',
        args: [vehicleId, feature, index] as SqlValue[],
      })),
    ];
  }

  insertStatement(vehicle: Vehicle, searchText: string): SqlStatement {
    const placeholders = VEHICLE_COLUMNS.map(() => '?').join(', ');
    return {
      sql: `INSERT INTO vehicles (${VEHICLE_COLUMNS.join(', ')}) VALUES (${placeholders})`,
      args: vehicleValues(vehicle, searchText),
    };
  }

  async insert(vehicle: Vehicle, searchText: string, features: string[]): Promise<void> {
    await this.db.batch([this.insertStatement(vehicle, searchText), ...this.featureStatements(vehicle.id, features)]);
  }

  /** Atualiza o veículo (e opcionais) atomicamente; registra slug antigo no histórico. */
  async update(
    vehicle: Vehicle,
    searchText: string,
    features: string[] | null,
    previousSlug: string | null,
  ): Promise<void> {
    const columns = VEHICLE_COLUMNS.filter((c) => c !== 'id' && c !== 'created_at');
    const values = vehicleValues(vehicle, searchText);
    const byColumn = new Map(VEHICLE_COLUMNS.map((c, i) => [c, values[i] ?? null]));
    const statements: SqlStatement[] = [
      {
        sql: `UPDATE vehicles SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        args: [...columns.map((c) => byColumn.get(c) ?? null), vehicle.id],
      },
    ];
    if (previousSlug && previousSlug !== vehicle.slug) {
      statements.push(
        { sql: 'DELETE FROM vehicle_slug_history WHERE slug = ?', args: [vehicle.slug] },
        {
          sql: 'INSERT OR REPLACE INTO vehicle_slug_history (slug, vehicle_id, created_at) VALUES (?, ?, ?)',
          args: [previousSlug, vehicle.id, vehicle.updatedAt],
        },
      );
    }
    if (features) statements.push(...this.featureStatements(vehicle.id, features));
    await this.db.batch(statements);
  }

  async touch(id: string, updatedAt: string): Promise<void> {
    await this.db.run('UPDATE vehicles SET updated_at = ? WHERE id = ?', [updatedAt, id]);
  }

  // ---------------------------------------------------------------------------
  // Consultas públicas
  // ---------------------------------------------------------------------------

  async searchPublic(
    filters: InventoryFilters,
    options: { now: Date; showSold: boolean; pageSize: number },
  ): Promise<{ items: VehicleCard[]; total: number }> {
    const nowIso = options.now.toISOString();
    const where: Where = { clauses: [], args: [] };
    publicVisibility(where, options.showSold);
    applyInventoryFilters(where, filters, nowIso);
    const ws = whereSql(where);

    const offset = (Math.max(1, filters.page) - 1) * options.pageSize;
    // Em paralelo: no Cloudflare cada consulta ao D1 é uma ida e volta pela rede.
    const [countRow, rows] = await Promise.all([
      this.db.first<{ total: number }>(`SELECT COUNT(*) AS total FROM vehicles v ${ws}`, where.args),
      this.db.all<VehicleCardRow>(`${CARD_SELECT} ${ws} ORDER BY ${orderBy(filters.sort)} LIMIT ? OFFSET ?`, [
        ...where.args,
        options.pageSize,
        offset,
      ]),
    ]);
    return { items: rows.map(mapVehicleCard), total: Number(countRow?.total ?? 0) };
  }

  /** Lista de cards por seção (destaques, ofertas, repasses) — nunca inclui vendidos. */
  async listSection(
    section: 'featured' | 'offers' | 'repasses' | 'latest',
    options: { now: Date; limit: number; excludeIds?: string[] },
  ): Promise<VehicleCard[]> {
    const nowIso = options.now.toISOString();
    const where: Where = { clauses: [], args: [] };
    publicVisibility(where, false);
    if (section === 'featured') where.clauses.push('v.featured = 1');
    if (section === 'repasses') where.clauses.push("v.commercial_type = 'repasse'");
    if (section === 'offers') {
      where.clauses.push(offerActiveSql());
      where.args.push(nowIso, nowIso);
    }
    if (options.excludeIds?.length) {
      where.clauses.push(`v.id NOT IN (${options.excludeIds.map(() => '?').join(', ')})`);
      where.args.push(...options.excludeIds);
    }
    const rows = await this.db.all<VehicleCardRow>(
      `${CARD_SELECT} ${whereSql(where)}
       ORDER BY CASE WHEN v.status = 'reserved' THEN 1 ELSE 0 END, COALESCE(v.published_at, v.created_at) DESC
       LIMIT ?`,
      [...where.args, options.limit],
    );
    return rows.map(mapVehicleCard);
  }

  /** Veículos semelhantes (mesma categoria, marca preferida), para a página do veículo. */
  async listSimilar(vehicle: Vehicle, limit: number): Promise<VehicleCard[]> {
    const where: Where = { clauses: [], args: [] };
    publicVisibility(where, false);
    where.clauses.push('v.id <> ?', 'v.category = ?');
    where.args.push(vehicle.id, vehicle.category);
    const rows = await this.db.all<VehicleCardRow>(
      `${CARD_SELECT} ${whereSql(where)}
       ORDER BY CASE WHEN v.brand = ? COLLATE NOCASE THEN 0 ELSE 1 END,
                ABS(COALESCE(v.price, 0) - ?) ASC
       LIMIT ?`,
      [...where.args, vehicle.brand, vehicle.price ?? 0, limit],
    );
    return rows.map(mapVehicleCard);
  }

  async listPublicByIds(ids: string[], showSold: boolean): Promise<VehicleCard[]> {
    if (ids.length === 0) return [];
    const where: Where = { clauses: [], args: [] };
    publicVisibility(where, showSold);
    where.clauses.push(`v.id IN (${ids.map(() => '?').join(', ')})`);
    where.args.push(...ids);
    const rows = await this.db.all<VehicleCardRow>(`${CARD_SELECT} ${whereSql(where)}`, where.args);
    const byId = new Map(rows.map((r) => [r.id, mapVehicleCard(r)]));
    return ids.map((id) => byId.get(id)).filter((v): v is VehicleCard => v !== undefined);
  }

  /**
   * Totais das abas do estoque (todos, ofertas, repasses) considerando os demais filtros
   * (categoria, marca, preço...), numa única consulta.
   */
  async countSections(
    filters: InventoryFilters,
    options: { now: Date; showSold: boolean },
  ): Promise<{ all: number; offers: number; repasses: number }> {
    const nowIso = options.now.toISOString();
    const base: InventoryFilters = { ...filters, offersOnly: false, repasseOnly: false };
    delete base.commercialType;
    const where: Where = { clauses: [], args: [] };
    publicVisibility(where, options.showSold);
    applyInventoryFilters(where, base, nowIso);
    const row = await this.db.first<{ total: number; offers: number | null; repasses: number | null }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN ${offerActiveSql()} THEN 1 ELSE 0 END) AS offers,
              SUM(CASE WHEN v.commercial_type = 'repasse' THEN 1 ELSE 0 END) AS repasses
       FROM vehicles v ${whereSql(where)}`,
      [nowIso, nowIso, ...where.args],
    );
    return { all: Number(row?.total ?? 0), offers: Number(row?.offers ?? 0), repasses: Number(row?.repasses ?? 0) };
  }

  async countSection(section: 'offers' | 'repasses', now: Date): Promise<number> {
    const nowIso = now.toISOString();
    const where: Where = { clauses: [], args: [] };
    publicVisibility(where, false);
    if (section === 'repasses') where.clauses.push("v.commercial_type = 'repasse'");
    else {
      where.clauses.push(offerActiveSql());
      where.args.push(nowIso, nowIso);
    }
    const row = await this.db.first<{ total: number }>(
      `SELECT COUNT(*) AS total FROM vehicles v ${whereSql(where)}`,
      where.args,
    );
    return Number(row?.total ?? 0);
  }

  async facets(filters: InventoryFilters, options: { now: Date; showSold: boolean }): Promise<InventoryFacets> {
    const base: Where = { clauses: [], args: [] };
    publicVisibility(base, options.showSold);
    const bw = whereSql(base);

    const [categories, brands, ranges, models] = await Promise.all([
      this.db.all<{ value: string; count: number }>(
        `SELECT v.category AS value, COUNT(*) AS count FROM vehicles v ${bw} GROUP BY v.category`,
        base.args,
      ),
      this.db.all<{ value: string; count: number }>(
        `SELECT MIN(v.brand) AS value, COUNT(*) AS count FROM vehicles v ${bw}
         ${filters.category ? 'AND v.category = ?' : ''}
         GROUP BY v.brand COLLATE NOCASE ORDER BY v.brand COLLATE NOCASE`,
        filters.category ? [...base.args, filters.category] : base.args,
      ),
      this.db.first<{
        year_min: number | null;
        year_max: number | null;
        price_min: number | null;
        price_max: number | null;
      }>(
        `SELECT MIN(COALESCE(v.model_year, v.manufacture_year)) AS year_min,
                MAX(COALESCE(v.model_year, v.manufacture_year)) AS year_max,
                MIN(v.price) AS price_min, MAX(v.price) AS price_max
         FROM vehicles v ${bw}`,
        base.args,
      ),
      filters.brand
        ? this.db.all<{ value: string; count: number }>(
            `SELECT MIN(v.model) AS value, COUNT(*) AS count FROM vehicles v ${bw} AND v.brand = ? COLLATE NOCASE
             GROUP BY v.model COLLATE NOCASE ORDER BY v.model COLLATE NOCASE`,
            [...base.args, filters.brand],
          )
        : Promise.resolve([] as FacetCount[]),
    ]);

    return {
      categories: categories.map((c) => ({ value: c.value, count: Number(c.count) })),
      brands: brands.map((b) => ({ value: b.value, count: Number(b.count) })),
      models: models.map((m) => ({ value: m.value, count: Number(m.count) })),
      yearRange: { min: ranges?.year_min ?? null, max: ranges?.year_max ?? null },
      priceRange: { min: ranges?.price_min ?? null, max: ranges?.price_max ?? null },
    };
  }

  /** Sugestões para o campo de busca (marcas e modelos presentes no estoque). */
  async searchSuggestions(limit = 60): Promise<string[]> {
    const [rows, brands] = await Promise.all([
      this.db.all<{ label: string }>(
        `SELECT DISTINCT v.brand || ' ' || v.model AS label FROM vehicles v
         WHERE v.deleted_at IS NULL AND v.published = 1 AND v.status IN ('available', 'reserved')
         ORDER BY label LIMIT ?`,
        [limit],
      ),
      this.db.all<{ label: string }>(
        `SELECT DISTINCT v.brand AS label FROM vehicles v
         WHERE v.deleted_at IS NULL AND v.published = 1 AND v.status IN ('available', 'reserved')
         ORDER BY label LIMIT 30`,
      ),
    ]);
    return [...new Set([...brands.map((b) => b.label), ...rows.map((r) => r.label)])];
  }

  async countPublicByCategory(): Promise<Record<VehicleCategory, number>> {
    const rows = await this.db.all<{ category: VehicleCategory; count: number }>(
      `SELECT category, COUNT(*) AS count FROM vehicles
       WHERE deleted_at IS NULL AND published = 1 AND status IN ('available', 'reserved')
       GROUP BY category`,
    );
    const result = { carro: 0, moto: 0, scooter: 0, pesado: 0, maquina_agricola: 0 };
    for (const row of rows) result[row.category] = Number(row.count);
    return result;
  }

  async listForSitemap(showSold: boolean): Promise<{ slug: string; updatedAt: string }[]> {
    const rows = await this.db.all<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM vehicles
       WHERE deleted_at IS NULL AND published = 1
         AND status IN ('available', 'reserved'${showSold ? ", 'sold'" : ''})
       ORDER BY updated_at DESC LIMIT 5000`,
    );
    return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async listAdmin(filters: AdminVehicleFilters): Promise<{ items: VehicleCard[]; total: number }> {
    const where: Where = { clauses: ['v.deleted_at IS NULL'], args: [] };
    if (filters.status) {
      where.clauses.push('v.status = ?');
      where.args.push(filters.status);
    } else {
      where.clauses.push("v.status <> 'archived'");
    }
    if (filters.q) {
      for (const term of searchTerms(filters.q)) {
        where.clauses.push(`v.search_text LIKE ? ESCAPE '\\'`);
        where.args.push(`%${escapeLike(term)}%`);
      }
    }
    if (filters.offersOnly) {
      where.clauses.push('v.is_offer = 1');
    }
    if (filters.repasseOnly) where.clauses.push("v.commercial_type = 'repasse'");
    if (filters.featuredOnly) where.clauses.push('v.featured = 1');
    if (filters.unpublishedOnly) where.clauses.push('v.published = 0');
    const ws = whereSql(where);
    const countRow = await this.db.first<{ total: number }>(
      `SELECT COUNT(*) AS total FROM vehicles v ${ws}`,
      where.args,
    );
    const rows = await this.db.all<VehicleCardRow>(
      `${CARD_SELECT} ${ws} ORDER BY v.updated_at DESC, v.id LIMIT ? OFFSET ?`,
      [...where.args, filters.pageSize, (Math.max(1, filters.page) - 1) * filters.pageSize],
    );
    return { items: rows.map(mapVehicleCard), total: Number(countRow?.total ?? 0) };
  }

  async stats(now: Date): Promise<VehicleStats> {
    const nowIso = now.toISOString();
    const row = await this.db.first<Record<keyof VehicleStats, number | null>>(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available,
         SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved,
         SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
         SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
         SUM(CASE WHEN commercial_type = 'repasse' AND status IN ('available', 'reserved') THEN 1 ELSE 0 END) AS repasses,
         SUM(CASE WHEN ${offerActiveSql('vehicles')} AND status IN ('available', 'reserved') THEN 1 ELSE 0 END) AS offers,
         SUM(CASE WHEN featured = 1 AND status IN ('available', 'reserved') THEN 1 ELSE 0 END) AS featured
       FROM vehicles WHERE deleted_at IS NULL`,
      [nowIso, nowIso],
    );
    const n = (v: number | null | undefined) => Number(v ?? 0);
    return {
      total: n(row?.total),
      available: n(row?.available),
      reserved: n(row?.reserved),
      sold: n(row?.sold),
      drafts: n(row?.drafts),
      archived: n(row?.archived),
      repasses: n(row?.repasses),
      offers: n(row?.offers),
      featured: n(row?.featured),
    };
  }

  async distinctBrands(): Promise<string[]> {
    const rows = await this.db.all<{ brand: string }>(
      'SELECT MIN(brand) AS brand FROM vehicles WHERE deleted_at IS NULL GROUP BY brand COLLATE NOCASE ORDER BY brand COLLATE NOCASE',
    );
    return rows.map((r) => r.brand);
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.batch([
      { sql: 'DELETE FROM vehicle_features WHERE vehicle_id = ?', args: [id] },
      { sql: 'DELETE FROM vehicle_images WHERE vehicle_id = ?', args: [id] },
      { sql: 'DELETE FROM vehicle_slug_history WHERE vehicle_id = ?', args: [id] },
      { sql: 'DELETE FROM vehicles WHERE id = ?', args: [id] },
    ]);
  }
}
