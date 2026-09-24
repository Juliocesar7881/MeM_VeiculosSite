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
  /** Também gerar a imagem de compartilhamento (JPEG 1200x630). */
  withOg?: boolean;
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
    const og = options.withOg ? await renderOg(source) : null;
    return { large, thumb, og };
  } finally {
    if ('close' in source) source.close();
  }
}

/**
 * Imagem de compartilhamento (WhatsApp/Facebook): JPEG 1200x630 com a foto recortada
 * ao centro, degradê inferior, faixa dourada e a logo M&M — gerada no navegador para
 * funcionar também no Cloudflare Workers (que não roda sharp).
 */
async function renderOg(source: ImageBitmap | HTMLImageElement): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new ImageProcessingError('Seu navegador não conseguiu processar a imagem.');
  const { width: sw, height: sh } = sourceSize(source);
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);

  const fade = ctx.createLinearGradient(0, H * 0.55, 0, H);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f2c12e';
  ctx.fillRect(0, H - 8, W, 8);

  const { LOGO_GOLD_PATHS, LOGO_SILVER_PATH, LOGO_TEXT_PATH, LOGO_VIEWBOX } =
    await import('@/components/brand/logo-data');
  const [vx = 0, vy = 0, vw = 1, vh = 1] = LOGO_VIEWBOX.split(' ').map(Number);
  const logoWidth = 300;
  const s = logoWidth / vw;
  ctx.save();
  ctx.translate(W - logoWidth - 40, H - vh * s - 34);
  ctx.scale(s, s);
  ctx.translate(-vx, -vy);
  ctx.fillStyle = '#f2c12e';
  for (const d of LOGO_GOLD_PATHS) ctx.fill(new Path2D(d));
  ctx.fill(new Path2D(LOGO_TEXT_PATH));
  ctx.fillStyle = '#f4f4f4';
  ctx.fill(new Path2D(LOGO_SILVER_PATH));
  ctx.restore();

  for (const quality of [0.84, 0.76, 0.68]) {
    const blob = await toBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= 380_000) return blob;
  }
  throw new ImageProcessingError('Não foi possível gerar a imagem de compartilhamento.');
}

export function extensionFor(blob: Blob): string {
  return blob.type === 'image/webp' ? 'webp' : 'jpg';
}
