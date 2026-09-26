/**
 * Dados institucionais exibidos no site (contatos, redes, textos).
 *
 * Esta é a fonte oficial: para trocar o WhatsApp, o e-mail ou incluir o endereço, edite aqui e
 * publique (o painel não tem tela de configurações). Componentes recebem estes dados pelo
 * `container.settings.get()`, nunca importando daqui direto.
 */
import type { SiteSettings } from '@/types/settings';

export const SITE_SETTINGS: SiteSettings = {
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
  /** Lado maior da versão média (celulares: galeria e cards em telas de alta densidade). */
  mediumMaxEdge: 1080,
  /** Limites de bytes aceitos no servidor, por arquivo já comprimido. */
  vehicleLargeMaxBytes: 1_200_000,
  vehicleMediumMaxBytes: 450_000,
  vehicleThumbMaxBytes: 250_000,
  leadLargeMaxEdge: 1600,
  leadLargeMaxBytes: 600_000,
  leadThumbMaxBytes: 150_000,
  /** Limite total do corpo da requisição do formulário público (Vercel aceita até 4,5 MB). */
  leadRequestMaxBytes: 4_300_000,
  /** Foto grande + média + miniatura + imagem de compartilhamento (OG) na mesma requisição. */
  vehicleRequestMaxBytes: 2_500_000,
  maxDimension: 4096,
} as const;

/**
 * Teto do espaço total de fotos, por armazenamento (bytes). Fica abaixo do gratuito da Cloudflare:
 * R2 = 10 GB grátis (acima disso seria cobrado no cartão); KV = 1 GB grátis. Outros: sem teto.
 */
export const STORAGE_CAP_BYTES: Record<string, number> = {
  r2: 9_000_000_000,
  kv: 900_000_000,
};
