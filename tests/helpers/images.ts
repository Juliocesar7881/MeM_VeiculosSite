import sharp from 'sharp';

/** Gera uma imagem sólida para testes. */
export async function makeImage(
  width: number,
  height: number,
  format: 'webp' | 'jpeg' | 'png' = 'webp',
  color = '#f2c12e',
): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 3, background: color } })
    .toFormat(format, { quality: 80 })
    .toBuffer();
  return new Uint8Array(buffer);
}

/** Par grande + miniatura com a mesma proporção (como o navegador envia). */
export async function makePair(width = 1600, height = 1200, format: 'webp' | 'jpeg' = 'webp') {
  // Igual ao navegador: o LADO MAIOR da miniatura fica com 720 px.
  const scale = 720 / Math.max(width, height);
  const thumbWidth = Math.round(width * scale);
  const thumbHeight = Math.round(height * scale);
  return {
    large: await makeImage(width, height, format),
    thumb: await makeImage(thumbWidth, thumbHeight, format),
  };
}
