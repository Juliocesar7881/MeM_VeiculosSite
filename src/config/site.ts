/**
 * Valores padrão dos dados institucionais.
 *
 * Os dados editáveis (telefone, redes, e-mail, textos...) ficam na tabela `site_settings`
 * e são alterados pelo painel. Estes valores são usados apenas como semente (migration)
 * e como fallback caso o banco esteja indisponível. Componentes NUNCA devem usar
 * telefone/e-mail/redes diretamente daqui — use `SiteSettings` vindo do serviço.
 */
import type { SiteSettings } from '@/types/settings';

export const DEFAULT_SETTINGS: SiteSettings = {
  businessName: 'M&M Veículos',
  slogan: 'Construindo credibilidade a cada negociação.',
  whatsapp: '554896410338',
  phone: '+55 48 9641-0338',
  instagram: 'mmveiculos.sc',
  facebook: 'https://www.facebook.com/profile.php?id=61573464239367',
  email: 'mmveiculos.sc@gmail.com',
  city: 'Massaranduba',
  state: 'SC',
  address: '',
  openingHours: '',
  showSoldVehicles: true,
  sellVehicleCta: 'Anuncie seu veículo',
  repasseDescription: '',
};

/** Constantes técnicas (não editáveis pelo painel). */
export const SITE_CONSTANTS = {
  locale: 'pt-BR',
  currency: 'BRL',
  timeZone: 'America/Sao_Paulo',
  /** Brasil não adota horário de verão desde 2019. */
  utcOffset: '-03:00',
  inventoryPageSize: 18,
  adminPageSize: 25,
  maxLeadPhotos: 6,
  maxVehiclePhotos: 30,
  homeSectionSize: 8,
} as const;

export const IMAGE_LIMITS = {
  /** Lado maior da imagem grande (galeria / página do veículo). */
  largeMaxEdge: 1920,
  /** Lado maior da miniatura (cards / thumbnails). */
  thumbMaxEdge: 720,
  /** Limites de bytes aceitos no servidor, por arquivo já comprimido. */
  vehicleLargeMaxBytes: 1_200_000,
  vehicleThumbMaxBytes: 250_000,
  leadLargeMaxEdge: 1600,
  leadLargeMaxBytes: 600_000,
  leadThumbMaxBytes: 150_000,
  /** Limite total do corpo da requisição do formulário público (Vercel aceita até 4,5 MB). */
  leadRequestMaxBytes: 4_300_000,
  vehicleRequestMaxBytes: 1_600_000,
  maxDimension: 4096,
} as const;
