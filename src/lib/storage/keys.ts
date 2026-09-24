/**
 * Convenção de chaves no storage:
 *
 *   vehicles/{vehicleId}/{imageId}.webp          (grande, ~1920px)
 *   vehicles/{vehicleId}/{imageId}-thumb.webp    (miniatura, ~720px)
 *   sell-leads/{leadId}/{imageId}.webp
 *   sell-leads/{leadId}/{imageId}-thumb.webp
 *
 * Fotos de propostas (sell-leads) nunca são misturadas com veículos publicados:
 * ao converter uma proposta, as fotos são COPIADAS para vehicles/.
 */
export type ImageVariant = 'large' | 'thumb';

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const EXT = '(webp|jpg)';

export const VEHICLE_KEY_PATTERN = new RegExp(`^vehicles/${UUID}/${UUID}(-thumb)?\\.${EXT}$`);
export const LEAD_KEY_PATTERN = new RegExp(`^sell-leads/${UUID}/${UUID}(-thumb)?\\.${EXT}$`);

function fileName(imageId: string, variant: ImageVariant, extension: string): string {
  return variant === 'thumb' ? `${imageId}-thumb.${extension}` : `${imageId}.${extension}`;
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

/** URL protegida (somente admin) de uma foto de proposta. */
export function leadMediaUrl(key: string): string {
  return `/api/admin/lead-media/${key}`;
}
