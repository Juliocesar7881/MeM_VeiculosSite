/**
 * Convenção de chaves no storage:
 *
 *   vehicles/{vehicleId}/{imageId}.webp          (grande, ~1920px)
 *   vehicles/{vehicleId}/{imageId}-md.webp       (média, ~1080px, para celulares)
 *   vehicles/{vehicleId}/{imageId}-thumb.webp    (miniatura, ~720px)
 *   vehicles/{vehicleId}/{imageId}-og.jpg        (compartilhamento, 1200x630)
 *   sell-leads/{leadId}/{imageId}.webp
 *   sell-leads/{leadId}/{imageId}-thumb.webp
 *
 * Fotos de propostas (sell-leads) nunca são misturadas com veículos publicados:
 * ao converter uma proposta, as fotos são COPIADAS para vehicles/.
 */
export type ImageVariant = 'large' | 'medium' | 'thumb' | 'og';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const EXT = '(webp|jpg)';

export const VEHICLE_KEY_PATTERN = new RegExp(`^vehicles/${UUID}/${UUID}(-thumb|-md|-og)?\\.${EXT}$`);
export const LEAD_KEY_PATTERN = new RegExp(`^sell-leads/${UUID}/${UUID}(-thumb)?\\.${EXT}$`);

function fileName(imageId: string, variant: ImageVariant, extension: string): string {
  if (variant === 'thumb') return `${imageId}-thumb.${extension}`;
  if (variant === 'medium') return `${imageId}-md.${extension}`;
  if (variant === 'og') return `${imageId}-og.${extension}`;
  return `${imageId}.${extension}`;
}

export function vehicleImageKey(vehicleId: string, imageId: string, variant: ImageVariant, extension: string): string {
  return `vehicles/${vehicleId}/${fileName(imageId, variant, extension)}`;
}

export function leadImageKey(leadId: string, imageId: string, variant: ImageVariant, extension: string): string {
  return `sell-leads/${leadId}/${fileName(imageId, variant, extension)}`;
}

export function isVehicleImageKey(key: string): boolean {
  return VEHICLE_KEY_PATTERN.test(key);
}

export function isLeadImageKey(key: string): boolean {
  return LEAD_KEY_PATTERN.test(key);
}

export function extensionOf(key: string): string {
  return key.slice(key.lastIndexOf('.') + 1);
}

export function contentTypeForKey(key: string): string {
  const ext = extensionOf(key);
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return 'application/octet-stream';
}

/** URL pública (servida pelo próprio site, com cache longo) de uma foto de veículo. */
export function mediaUrl(key: string): string {
  return `/media/${key}`;
}

/** srcset de uma foto de veículo: miniatura, média (quando existir) e grande. */
export function vehicleSrcset(image: {
  thumbKey: string;
  thumbWidth: number;
  largeKey: string;
  width: number;
  mediumKey?: string | null;
  mediumWidth?: number | null;
}): string {
  const entries = [`${mediaUrl(image.thumbKey)} ${image.thumbWidth}w`];
  if (image.mediumKey && image.mediumWidth) entries.push(`${mediaUrl(image.mediumKey)} ${image.mediumWidth}w`);
  entries.push(`${mediaUrl(image.largeKey)} ${image.width}w`);
  return entries.join(', ');
}

/** URL protegida (somente admin) de uma foto de proposta. */
export function leadMediaUrl(key: string): string {
  return `/api/admin/lead-media/${key}`;
}
