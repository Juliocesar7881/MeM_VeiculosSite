/**
 * Catálogo de valores do domínio (categorias, combustíveis, câmbios, status...).
 * Fonte única para validação, rótulos da interface e slugs de URL.
 */

export const VEHICLE_CATEGORIES = ['carro', 'moto', 'scooter', 'pesado', 'maquina_agricola'] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const CATEGORY_INFO: Record<
  VehicleCategory,
  { label: string; plural: string; slug: string; usesHours: boolean }
> = {
  carro: { label: 'Carro', plural: 'Carros', slug: 'carros', usesHours: false },
  moto: { label: 'Moto', plural: 'Motos', slug: 'motos', usesHours: false },
  scooter: { label: 'Scooter', plural: 'Scooters', slug: 'scooters', usesHours: false },
  pesado: { label: 'Pesado', plural: 'Pesados', slug: 'pesados', usesHours: false },
  maquina_agricola: {
    label: 'Máquina agrícola',
    plural: 'Máquinas agrícolas',
    slug: 'maquinas-agricolas',
    usesHours: true,
  },
};

export function categoryFromSlug(slug: string | null | undefined): VehicleCategory | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  return VEHICLE_CATEGORIES.find((category) => CATEGORY_INFO[category].slug === normalized || category === normalized);
}

export const VEHICLE_STATUSES = ['draft', 'available', 'reserved', 'sold', 'archived'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  draft: 'Rascunho',
  available: 'Disponível',
  reserved: 'Reservado',
  sold: 'Vendido',
  archived: 'Arquivado',
};

/** Status que aparecem no site público. Rascunho e Arquivado ficam só no painel. */
export const PUBLIC_STATUSES = ['available', 'reserved', 'sold'] as const;
export type PublicStatus = (typeof PUBLIC_STATUSES)[number];

/** Publicação segue o status: todo veículo fora de rascunho/arquivado está no site. */
export function isPublicStatus(status: VehicleStatus): status is PublicStatus {
  return (PUBLIC_STATUSES as readonly VehicleStatus[]).includes(status);
}

export const PUBLIC_STATUS_SLUGS: Record<PublicStatus, string> = {
  available: 'disponivel',
  reserved: 'reservado',
  sold: 'vendido',
};

export const COMMERCIAL_TYPES = ['normal', 'repasse'] as const;
export type CommercialType = (typeof COMMERCIAL_TYPES)[number];

export const COMMERCIAL_TYPE_LABELS: Record<CommercialType, string> = {
  normal: 'Normal',
  repasse: 'Repasse',
};

export const FUELS = ['flex', 'gasolina', 'etanol', 'diesel', 'eletrico', 'hibrido', 'gnv'] as const;
export type Fuel = (typeof FUELS)[number];

export const FUEL_LABELS: Record<Fuel, string> = {
  flex: 'Flex',
  gasolina: 'Gasolina',
  etanol: 'Etanol',
  diesel: 'Diesel',
  eletrico: 'Elétrico',
  hibrido: 'Híbrido',
  gnv: 'GNV',
};

export const TRANSMISSIONS = ['manual', 'automatico', 'automatizado', 'cvt'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  manual: 'Manual',
  automatico: 'Automático',
  automatizado: 'Automatizado',
  cvt: 'CVT',
};

export const LEAD_STATUSES = [
  'new',
  'reviewing',
  'contacted',
  'negotiating',
  'accepted',
  'rejected',
  'converted',
  'archived',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nova',
  reviewing: 'Em análise',
  contacted: 'Contatado',
  negotiating: 'Em negociação',
  accepted: 'Aceita',
  rejected: 'Recusada',
  converted: 'Convertida em veículo',
  archived: 'Arquivada',
};

export const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export type BrazilState = (typeof BRAZIL_STATES)[number];

export const SORT_OPTIONS = ['recentes', 'menor-preco', 'maior-preco', 'menor-km', 'maior-km'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  recentes: 'Mais recentes',
  'menor-preco': 'Menor preço',
  'maior-preco': 'Maior preço',
  'menor-km': 'Menor km',
  'maior-km': 'Maior km',
};

/** Sugestões de carroceria exibidas no admin (campo continua livre). */
export const BODY_TYPE_SUGGESTIONS = [
  'Hatch',
  'Sedã',
  'SUV',
  'Picape',
  'Minivan',
  'Perua/SW',
  'Cupê',
  'Conversível',
  'Utilitário',
  'Van',
  'Furgão',
  'Caminhão',
  'Cavalo mecânico',
  'Ônibus',
  'Street',
  'Trail',
  'Custom',
  'Esportiva',
  'Naked',
  'Scooter',
  'Trator',
  'Colheitadeira',
  'Pulverizador',
  'Plantadeira',
] as const;

export const COLOR_SUGGESTIONS = [
  'Branco',
  'Preto',
  'Prata',
  'Cinza',
  'Vermelho',
  'Azul',
  'Verde',
  'Amarelo',
  'Laranja',
  'Marrom',
  'Bege',
  'Dourado',
  'Vinho',
  'Grafite',
] as const;

/** Opcionais comuns, agrupados para facilitar o cadastro. */
export const FEATURE_SUGGESTIONS = [
  'Ar-condicionado',
  'Direção hidráulica',
  'Direção elétrica',
  'Direção mecânica',
  'Vidros elétricos',
  'Travas elétricas',
  'Retrovisores elétricos',
  'Alarme',
  'Airbag',
  'Freios ABS',
  'Freio a disco dianteiro',
  'Freio a disco dianteiro e traseiro',
  'Controle de tração',
  'Controle de estabilidade',
  'Multimídia',
  'Android Auto / Apple CarPlay',
  'Bluetooth',
  'Câmera de ré',
  'Sensor de estacionamento',
  'Piloto automático',
  'Bancos de couro',
  'Rodas de liga leve',
  'Teto solar',
  'Faróis de LED',
  'Faróis de neblina',
  'Chave presencial',
  'Partida por botão',
  'Partida elétrica',
  'Computador de bordo',
  'Volante multifuncional',
  'Ar-condicionado digital',
  'Engate',
  'Protetor de caçamba',
  'Capota marítima',
  '4x4',
  'Único dono',
  'Manual e chave reserva',
  'Revisões em concessionária',
  'IPVA pago',
] as const;
