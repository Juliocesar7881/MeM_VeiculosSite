import type { CommercialType, Fuel, LeadStatus, Transmission, VehicleCategory, VehicleStatus } from '@/config/catalog';
import { toBool } from '@/lib/db/types';
import type { ImageRef, LeadImage, Vehicle, VehicleCard, VehicleImage, VehicleLead } from '@/types/domain';

type Nullable<T> = T | null;

export interface VehicleRow {
  id: string;
  slug: string;
  category: string;
  brand: string;
  model: string;
  version: Nullable<string>;
  manufacture_year: Nullable<number>;
  model_year: Nullable<number>;
  mileage: Nullable<number>;
  usage_hours: Nullable<number>;
  fuel: Nullable<string>;
  transmission: Nullable<string>;
  color: Nullable<string>;
  body_type: Nullable<string>;
  price: Nullable<number>;
  previous_price: Nullable<number>;
  description: Nullable<string>;
  status: string;
  featured: number;
  is_offer: number;
  commercial_type: string;
  offer_start_at: Nullable<string>;
  offer_end_at: Nullable<string>;
  published: number;
  city: Nullable<string>;
  state: Nullable<string>;
  search_text: string;
  source_lead_id: Nullable<string>;
  sold_at: Nullable<string>;
  created_at: string;
  updated_at: string;
  published_at: Nullable<string>;
  deleted_at: Nullable<string>;
}

export function mapVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category as VehicleCategory,
    brand: row.brand,
    model: row.model,
    version: row.version,
    manufactureYear: row.manufacture_year,
    modelYear: row.model_year,
    mileage: row.mileage,
    usageHours: row.usage_hours,
    fuel: row.fuel as Fuel | null,
    transmission: row.transmission as Transmission | null,
    color: row.color,
    bodyType: row.body_type,
    price: row.price,
    previousPrice: row.previous_price,
    description: row.description,
    status: row.status as VehicleStatus,
    featured: toBool(row.featured),
    isOffer: toBool(row.is_offer),
    commercialType: row.commercial_type as CommercialType,
    offerStartAt: row.offer_start_at,
    offerEndAt: row.offer_end_at,
    published: toBool(row.published),
    city: row.city,
    state: row.state,
    sourceLeadId: row.source_lead_id,
    soldAt: row.sold_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    deletedAt: row.deleted_at,
  };
}

export interface CoverColumns {
  cover_large_key: Nullable<string>;
  cover_thumb_key: Nullable<string>;
  cover_width: Nullable<number>;
  cover_height: Nullable<number>;
  cover_thumb_width: Nullable<number>;
  cover_thumb_height: Nullable<number>;
  image_count: number;
}

export function mapCover(row: CoverColumns): ImageRef | null {
  if (!row.cover_large_key || !row.cover_thumb_key) return null;
  return {
    largeKey: row.cover_large_key,
    thumbKey: row.cover_thumb_key,
    width: row.cover_width ?? 1600,
    height: row.cover_height ?? 1200,
    thumbWidth: row.cover_thumb_width ?? 720,
    thumbHeight: row.cover_thumb_height ?? 540,
  };
}

export type VehicleCardRow = VehicleRow & CoverColumns;

export function mapVehicleCard(row: VehicleCardRow): VehicleCard {
  const v = mapVehicle(row);
  return {
    id: v.id,
    slug: v.slug,
    category: v.category,
    brand: v.brand,
    model: v.model,
    version: v.version,
    manufactureYear: v.manufactureYear,
    modelYear: v.modelYear,
    mileage: v.mileage,
    usageHours: v.usageHours,
    fuel: v.fuel,
    transmission: v.transmission,
    price: v.price,
    previousPrice: v.previousPrice,
    status: v.status,
    featured: v.featured,
    isOffer: v.isOffer,
    commercialType: v.commercialType,
    offerStartAt: v.offerStartAt,
    offerEndAt: v.offerEndAt,
    published: v.published,
    city: v.city,
    state: v.state,
    cover: mapCover(row),
    imageCount: Number(row.image_count ?? 0),
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

export interface ImageRow {
  id: string;
  large_key: string;
  thumb_key: string;
  width: number;
  height: number;
  thumb_width: number;
  thumb_height: number;
  content_type: string;
  size_bytes: number;
  position: number;
  created_at: string;
}

export function mapVehicleImage(row: ImageRow & { vehicle_id: string; og_key?: string | null }): VehicleImage {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    largeKey: row.large_key,
    thumbKey: row.thumb_key,
    ogKey: row.og_key ?? null,
    width: row.width,
    height: row.height,
    thumbWidth: row.thumb_width,
    thumbHeight: row.thumb_height,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function mapLeadImage(row: ImageRow & { lead_id: string }): LeadImage {
  return {
    id: row.id,
    leadId: row.lead_id,
    largeKey: row.large_key,
    thumbKey: row.thumb_key,
    width: row.width,
    height: row.height,
    thumbWidth: row.thumb_width,
    thumbHeight: row.thumb_height,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    position: row.position,
    createdAt: row.created_at,
  };
}

export interface LeadRow {
  id: string;
  status: string;
  name: string;
  whatsapp: string;
  email: Nullable<string>;
  category: string;
  brand: string;
  model: string;
  version: Nullable<string>;
  manufacture_year: number;
  model_year: Nullable<number>;
  mileage: Nullable<number>;
  usage_hours: Nullable<number>;
  fuel: Nullable<string>;
  transmission: Nullable<string>;
  color: Nullable<string>;
  city: Nullable<string>;
  state: Nullable<string>;
  desired_price: Nullable<number>;
  description: Nullable<string>;
  consent_text: string;
  consent_at: string;
  admin_notes: Nullable<string>;
  converted_vehicle_id: Nullable<string>;
  created_at: string;
  updated_at: string;
}

export function mapLead(row: LeadRow): VehicleLead {
  return {
    id: row.id,
    status: row.status as LeadStatus,
    name: row.name,
    whatsapp: row.whatsapp,
    email: row.email,
    category: row.category as VehicleCategory,
    brand: row.brand,
    model: row.model,
    version: row.version,
    manufactureYear: row.manufacture_year,
    modelYear: row.model_year,
    mileage: row.mileage,
    usageHours: row.usage_hours,
    fuel: row.fuel as Fuel | null,
    transmission: row.transmission as Transmission | null,
    color: row.color,
    city: row.city,
    state: row.state,
    desiredPrice: row.desired_price,
    description: row.description,
    consentText: row.consent_text,
    consentAt: row.consent_at,
    adminNotes: row.admin_notes,
    convertedVehicleId: row.converted_vehicle_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
