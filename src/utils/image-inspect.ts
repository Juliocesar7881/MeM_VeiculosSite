/**
 * Inspeção de imagens sem dependências nativas (funciona em Node, Vercel e Cloudflare Workers).
 * Identifica o formato real pelos "magic bytes" e lê as dimensões do cabeçalho.
 */

export type ImageFormat = 'webp' | 'jpeg' | 'png';

export const IMAGE_MIME: Record<ImageFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

export const IMAGE_EXT: Record<ImageFormat, string> = {
  webp: 'webp',
  jpeg: 'jpg',
  png: 'png',
};

export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length < 12) return null;
  // RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'webp';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png';
  }
  return null;
}

export interface Dimensions {
  width: number;
  height: number;
}

function u16be(b: Uint8Array, o: number): number {
  return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
}
function u16le(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
}
function u24le(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16);
}
function u32be(b: Uint8Array, o: number): number {
  return (((b[o] ?? 0) << 24) >>> 0) + (((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0));
}

function webpDimensions(b: Uint8Array): Dimensions | null {
  const chunk = String.fromCharCode(b[12] ?? 0, b[13] ?? 0, b[14] ?? 0, b[15] ?? 0);
  if (chunk === 'VP8 ') {
    // Frame tag (3 bytes) + start code 9d 01 2a
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null;
    const b1 = b[21] ?? 0;
    const b2 = b[22] ?? 0;
    const b3 = b[23] ?? 0;
    const b4 = b[24] ?? 0;
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    return { width, height };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + u24le(b, 24), height: 1 + u24le(b, 27) };
  }
  return null;
}

function jpegDimensions(b: Uint8Array): Dimensions | null {
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = b[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = u16be(b, offset + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { height: u16be(b, offset + 5), width: u16be(b, offset + 7) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function pngDimensions(b: Uint8Array): Dimensions | null {
  if (String.fromCharCode(b[12] ?? 0, b[13] ?? 0, b[14] ?? 0, b[15] ?? 0) !== 'IHDR') return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

export function readImageDimensions(bytes: Uint8Array, format: ImageFormat): Dimensions | null {
  const dims =
    format === 'webp' ? webpDimensions(bytes) : format === 'jpeg' ? jpegDimensions(bytes) : pngDimensions(bytes);
  if (!dims || dims.width <= 0 || dims.height <= 0) return null;
  return dims;
}

export interface InspectedImage extends Dimensions {
  format: ImageFormat;
  contentType: string;
  extension: string;
  size: number;
}

export interface InspectLimits {
  maxBytes: number;
  maxEdge: number;
  allowed?: readonly ImageFormat[];
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

/** Valida formato real, tamanho em bytes e dimensões. Lança ImageValidationError. */
export function inspectImage(bytes: Uint8Array, limits: InspectLimits): InspectedImage {
  if (bytes.byteLength === 0) throw new ImageValidationError('Arquivo de imagem vazio.');
  if (bytes.byteLength > limits.maxBytes) {
    throw new ImageValidationError('Imagem muito grande após compressão.');
  }
  const format = detectImageFormat(bytes);
  const allowed = limits.allowed ?? (['webp', 'jpeg'] as const);
  if (!format || !allowed.includes(format)) {
    throw new ImageValidationError('Formato de imagem não suportado.');
  }
  const dims = readImageDimensions(bytes, format);
  if (!dims) throw new ImageValidationError('Não foi possível ler as dimensões da imagem.');
  if (dims.width > limits.maxEdge || dims.height > limits.maxEdge) {
    throw new ImageValidationError('Dimensões da imagem acima do permitido.');
  }
  return {
    ...dims,
    format,
    contentType: IMAGE_MIME[format],
    extension: IMAGE_EXT[format],
    size: bytes.byteLength,
  };
}
