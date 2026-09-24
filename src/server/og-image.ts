import { LOGO_GOLD_PATHS, LOGO_SILVER_PATH, LOGO_TEXT_PATH, LOGO_VIEWBOX } from '@/components/brand/logo-data';

const WIDTH = 1200;
const HEIGHT = 630;

async function toBuffer(body: ReadableStream<Uint8Array> | Uint8Array): Promise<Buffer> {
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function overlaySvg(): string {
  const [vx, vy, vw, vh] = LOGO_VIEWBOX.split(' ').map(Number) as [number, number, number, number];
  const logoWidth = 300;
  const logoHeight = (logoWidth * vh) / vw;
  const scale = logoWidth / vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.78"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>
  <rect y="${HEIGHT - 8}" width="${WIDTH}" height="8" fill="#f2c12e"/>
  <g transform="translate(${WIDTH - logoWidth - 40} ${HEIGHT - logoHeight - 34}) scale(${scale}) translate(${-vx} ${-vy})">
    ${LOGO_GOLD_PATHS.map((d) => `<path d="${d}" fill="#f2c12e"/>`).join('')}
    <path d="${LOGO_SILVER_PATH}" fill="#f4f4f4"/>
    <path d="${LOGO_TEXT_PATH}" fill="#f2c12e"/>
  </g>
</svg>`;
}

/** Gera JPEG 1200x630 com a foto do veículo e a marca M&M. Requer sharp (Node). */
export async function renderOgImage(body: ReadableStream<Uint8Array> | Uint8Array): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  const source = await toBuffer(body);
  return sharp(source)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .composite([{ input: Buffer.from(overlaySvg()), top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
