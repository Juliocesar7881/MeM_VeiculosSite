import type { CommercialType, Fuel, LeadStatus, Transmission, VehicleCategory, VehicleStatus } from '@/config/catalog';

/** Valores monetários sempre em centavos (inteiro). */
export type Cents = number;

export interface Vehicle {
  id: string;
  slug: string;
  category: VehicleCategory;
  brand: string;
  model: string;
  version: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  mileage: number | null;
  usageHours: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  color: string | null;
  bodyType: string | null;
  price: Cents | null;
  previousPrice: Cents | null;
  description: string | null;
  status: VehicleStatus;
  featured: boolean;
  isOffer: boolean;
  commercialType: CommercialType;
  offerStartAt: string | null;
  offerEndAt: string | null;
  published: boolean;
  city: string | null;
  state: string | null;
  sourceLeadId: string | null;
  soldAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
}

export interface VehicleImage {
  id: string;
  vehicleId: string;
  largeKey: string;
  thumbKey: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  contentType: string;
  sizeBytes: number;
  position: number;
  createdAt: string;
}

export interface ImageRef {
  largeKey: string;
  thumbKey: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
}

export interface VehicleDetail extends Vehicle {
  images: VehicleImage[];
  features: string[];
}

/** Dados mínimos para renderizar um card de veículo. */
export interface VehicleCard {
  id: string;
  slug: string;
  category: VehicleCategory;
  brand: string;
  model: string;
  version: string | null;
  manufactureYear: number | null;
  modelYear: number | null;
  mileage: number | null;
  usageHours: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  price: Cents | null;
  previousPrice: Cents | null;
  status: VehicleStatus;
  featured: boolean;
  isOffer: boolean;
  commercialType: CommercialType;
  offerStartAt: string | null;
  offerEndAt: string | null;
  published: boolean;
  city: string | null;
  state: string | null;
  cover: ImageRef | null;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleLead {
  id: string;
  status: LeadStatus;
  name: string;
  whatsapp: string;
  email: string | null;
  category: VehicleCategory;
  brand: string;
  model: string;
  version: string | null;
  manufactureYear: number;
  modelYear: number | null;
  mileage: number | null;
  usageHours: number | null;
  fuel: Fuel | null;
  transmission: Transmission | null;
  color: string | null;
  city: string | null;
  state: string | null;
  desiredPrice: Cents | null;
  description: string | null;
  consentText: string;
  consentAt: string;
  adminNotes: string | null;
  convertedVehicleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadImage {
  id: string;
  leadId: string;
  largeKey: string;
  thumbKey: string;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
  contentType: string;
  sizeBytes: number;
  position: number;
  createdAt: string;
}

export interface LeadDetail extends VehicleLead {
  images: LeadImage[];
}

export interface LeadListItem extends VehicleLead {
  cover: ImageRef | null;
  imageCount: number;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminActor {
  id: string;
  label: string;
  method: 'password' | 'cloudflare-access';
}
