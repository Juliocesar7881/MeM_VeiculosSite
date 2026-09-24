-- M&M Veículos — schema inicial
-- Dialeto SQLite: compatível com libSQL/Turso e Cloudflare D1.
-- Datas em ISO 8601 UTC (TEXT). Valores monetários em centavos (INTEGER).
-- Booleanos como INTEGER 0/1.

CREATE TABLE vehicles (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('carro', 'moto', 'scooter', 'pesado', 'maquina_agricola')),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT,
  manufacture_year INTEGER,
  model_year INTEGER,
  mileage INTEGER CHECK (mileage IS NULL OR mileage >= 0),
  usage_hours INTEGER CHECK (usage_hours IS NULL OR usage_hours >= 0),
  fuel TEXT CHECK (fuel IS NULL OR fuel IN ('flex', 'gasolina', 'etanol', 'diesel', 'eletrico', 'hibrido', 'gnv')),
  transmission TEXT CHECK (transmission IS NULL OR transmission IN ('manual', 'automatico', 'automatizado', 'cvt')),
  color TEXT,
  body_type TEXT,
  price INTEGER CHECK (price IS NULL OR price >= 0),
  previous_price INTEGER CHECK (previous_price IS NULL OR previous_price >= 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'reserved', 'sold', 'archived')),
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  is_offer INTEGER NOT NULL DEFAULT 0 CHECK (is_offer IN (0, 1)),
  commercial_type TEXT NOT NULL DEFAULT 'normal' CHECK (commercial_type IN ('normal', 'repasse')),
  offer_start_at TEXT,
  offer_end_at TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  city TEXT,
  state TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  source_lead_id TEXT,
  sold_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  deleted_at TEXT
);

CREATE INDEX idx_vehicles_public ON vehicles (deleted_at, published, status, published_at);
CREATE INDEX idx_vehicles_brand ON vehicles (brand COLLATE NOCASE, model COLLATE NOCASE);
CREATE INDEX idx_vehicles_category ON vehicles (category);
CREATE INDEX idx_vehicles_price ON vehicles (price);
CREATE INDEX idx_vehicles_flags ON vehicles (featured, is_offer, commercial_type);
CREATE INDEX idx_vehicles_updated ON vehicles (updated_at);

CREATE TABLE vehicle_images (
  id TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  large_key TEXT NOT NULL,
  thumb_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumb_width INTEGER NOT NULL,
  thumb_height INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_vehicle_images_vehicle ON vehicle_images (vehicle_id, position);

CREATE TABLE vehicle_features (
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (vehicle_id, feature)
);

CREATE TABLE vehicle_slug_history (
  slug TEXT PRIMARY KEY NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_vehicle_slug_history_vehicle ON vehicle_slug_history (vehicle_id);

CREATE TABLE vehicle_leads (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'contacted', 'negotiating', 'accepted', 'rejected', 'converted', 'archived')),
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  category TEXT NOT NULL CHECK (category IN ('carro', 'moto', 'scooter', 'pesado', 'maquina_agricola')),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  version TEXT,
  manufacture_year INTEGER NOT NULL,
  model_year INTEGER,
  mileage INTEGER,
  usage_hours INTEGER,
  fuel TEXT,
  transmission TEXT,
  color TEXT,
  city TEXT,
  state TEXT,
  desired_price INTEGER,
  description TEXT,
  consent_text TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  ip_hash TEXT,
  admin_notes TEXT,
  converted_vehicle_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_vehicle_leads_status ON vehicle_leads (status, created_at);
CREATE INDEX idx_vehicle_leads_created ON vehicle_leads (created_at);

CREATE TABLE vehicle_lead_images (
  id TEXT PRIMARY KEY NOT NULL,
  lead_id TEXT NOT NULL REFERENCES vehicle_leads (id) ON DELETE CASCADE,
  large_key TEXT NOT NULL,
  thumb_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  thumb_width INTEGER NOT NULL,
  thumb_height INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_vehicle_lead_images_lead ON vehicle_lead_images (lead_id, position);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_admin_audit_log_created ON admin_audit_log (created_at);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log (entity_type, entity_id);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
