/**
 * Compressão de fotos no navegador antes do upload:
 * - corrige orientação (EXIF) e remove metadados (inclusive localização GPS);
 * - reduz para o tamanho máximo configurado;
 * - codifica em WebP (fallback JPEG em navegadores sem encoder WebP);
 * - gera a miniatura a partir da mesma imagem (proporção idêntica).
 */
export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

export interface PairOptions {
  largeEdge: number;
  largeMaxBytes: number;
  thumbEdge: number;
  thumbMaxBytes: number;
}

export class ImageProcessingError extends Error {}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Alguns formatos (ex.: HEIC em navegadores sem suporte) falham aqui.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new ImageProcessingError('Não foi possível ler esta imagem. Envie fotos em JPG, PNG ou WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

let webpSupported: boolean | null = null;
async function supportsWebpEncoding(): Promise<boolean> {
  if (webpSupported !== null) return webpSupported;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const blob = await toBlob(canvas, 'image/webp', 0.8);
  webpSupported = blob?.type === 'image/webp';
  return webpSupported;
}

async function render(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  maxBytes: number,
): Promise<CompressedImage> {
  const { width: sw, height: sh } = sourceSize(source);
  if (!sw || !sh) throw new ImageProcessingError('Imagem inválida.');
  const type = (await supportsWebpEncoding()) ? 'image/webp' : 'image/jpeg';
  let edge = Math.min(maxEdge, Math.max(sw, sh));

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const scale = edge / Math.max(sw, sh);
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new ImageProcessingError('Seu navegador não conseguiu processar a imagem.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, width, height);

    for (const quality of [0.82, 0.74, 0.66, 0.58]) {
      const blob = await toBlob(canvas, type, quality);
      if (blob && blob.size <= maxBytes) return { blob, width, height };
    }
    edge = Math.round(edge * 0.82);
  }
  throw new ImageProcessingError('Não foi possível reduzir esta imagem. Tente outra foto.');
}

export async function makeImagePair(file: File, options: PairOptions) {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    throw new ImageProcessingError('Arquivo não é uma imagem.');
  }
  if (file.size > 40 * 1024 * 1024) throw new ImageProcessingError('Imagem muito grande (máx. 40 MB).');
  const source = await decode(file);
  try {
    const large = await render(source, options.largeEdge, options.largeMaxBytes);
    const thumb = await render(source, options.thumbEdge, options.thumbMaxBytes);
    return { large, thumb };
  } finally {
    if ('close' in source) source.close();
  }
}

export function extensionFor(blob: Blob): string {
  return blob.type === 'image/webp' ? 'webp' : 'jpg';
}
