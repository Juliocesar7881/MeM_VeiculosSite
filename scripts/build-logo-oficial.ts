/**
 * Logo OFICIAL da M&M Veículos (arquivo enviado pela loja: docs/brand/logo-oficial.jpg, fundo preto).
 *
 * O fundo preto vira transparência (a logo assenta em qualquer fundo escuro do site, sem "quadrado"):
 * a opacidade de cada pixel vem do brilho dele e a cor é recomposta, então as bordas suaves continuam
 * suaves. Restos quase invisíveis da compressão JPEG (brilho baixo) são descartados.
 *
 * Saídas:
 *  - public/brand/mm-veiculos-logo.webp (+ -sm)  (transparente; o navegador escolhe pelo tamanho da tela)
 *  - public/brand/mm-veiculos-logo.png           (dados estruturados / Google)
 *  - src/components/brand/logo-oficial.ts         (caminho e proporção usados pelo componente Logo)
 *  - public/og-default.jpg                        (imagem padrão de compartilhamento, 1200x630)
 *
 * Uso: npm run brand:logo
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'docs/brand/logo-oficial.jpg');
/** Abaixo disso é ruído do JPEG (inclui um resto de texto invisível embaixo da logo). */
const NOISE = 16;
/** A partir deste brilho o pixel é totalmente opaco (miolo das letras e dos traços). */
const SOLID = 170;
const SCALE = 2;

/** Linha (na imagem original) acima da qual começam só os traços do carro; as letras começam em ~290. */
const TEXT_TOP = 285;

interface Rgba {
  data: Buffer;
  width: number;
  height: number;
}

/** Fundo preto -> transparência, recompondo a cor das bordas. */
async function unscreen(): Promise<Rgba> {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 3;
      const o = (y * info.width + x) * 4;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const alpha = Math.min(1, Math.max(0, (Math.max(r, g, b) - NOISE) / (SOLID - NOISE)));
      if (alpha === 0) continue;
      // Pixel da imagem = cor × opacidade sobre preto: recompõe a cor original das bordas.
      out[o] = Math.min(255, Math.round(r / alpha));
      out[o + 1] = Math.min(255, Math.round(g / alpha));
      out[o + 2] = Math.min(255, Math.round(b / alpha));
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return { data: out, width: info.width, height: info.height };
}

/**
 * Só o traço do carro (dourado + prata), sem o texto: mantém as peças conectadas que começam acima
 * de TEXT_TOP, com uma margem de 2 px para levar junto as bordas suaves.
 */
function strokesOnly(img: Rgba): Rgba {
  const { data, width, height } = img;
  const solid = (p: number) => (data[p * 4 + 3] ?? 0) > 40;
  const seen = new Uint8Array(width * height);
  const keep = new Uint8Array(width * height);
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || !solid(start)) continue;
    const stack = [start];
    const pixels: number[] = [];
    seen[start] = 1;
    let minY = height;
    while (stack.length) {
      const p = stack.pop() as number;
      pixels.push(p);
      const x = p % width;
      const y = Math.floor(p / width);
      minY = Math.min(minY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!seen[np] && solid(np)) {
            seen[np] = 1;
            stack.push(np);
          }
        }
      }
    }
    if (minY < TEXT_TOP) for (const p of pixels) keep[p] = 1;
  }
  const out = Buffer.alloc(data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy += 1) {
        for (let dx = -2; dx <= 2 && !near; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && keep[ny * width + nx]) near = true;
        }
      }
      if (near) data.copy(out, (y * width + x) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4);
    }
  }
  return { data: out, width, height };
}

/** Recorta no conteúdo (com folga), amplia 2x e devolve o PNG transparente. */
async function cropScaled(img: Rgba): Promise<{ png: Buffer; width: number; height: number }> {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 25) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  const info = { width: img.width, height: img.height };
  const out = img.data;
  const pad = 3;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(info.width, maxX + pad + 1) - left;
  const height = Math.min(info.height, maxY + pad + 1) - top;
  const png = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width, height })
    .resize(width * SCALE, height * SCALE, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  return { png, width: width * SCALE, height: height * SCALE };
}

async function main() {
  const full = await unscreen();
  const logo = await cropScaled(full);
  const strokes = await cropScaled(strokesOnly(full));
  const outBrand = path.join(ROOT, 'public/brand');
  await sharp(logo.png)
    .png({ palette: true, quality: 95, compressionLevel: 9 })
    .toFile(path.join(outBrand, 'mm-veiculos-logo.png'));
  await sharp(logo.png).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(outBrand, 'mm-veiculos-logo.webp'));
  const small = Math.round(logo.width / 2);
  await sharp(logo.png)
    .resize(small)
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(path.join(outBrand, 'mm-veiculos-logo-sm.webp'));
  // Só o traço do carro: fundo de "Fotos em breve" e arte da chamada "Quer vender seu veículo?".
  await sharp(strokes.png)
    .webp({ quality: 88, alphaQuality: 90 })
    .toFile(path.join(outBrand, 'mm-veiculos-traco.webp'));

  const aspect = logo.width / logo.height;
  await writeFile(
    path.join(ROOT, 'src/components/brand/logo-oficial.ts'),
    `// Arquivo gerado por scripts/build-logo-oficial.ts — não editar manualmente.
export const LOGO_OFICIAL = {
  src: '/brand/mm-veiculos-logo.webp',
  srcSmall: '/brand/mm-veiculos-logo-sm.webp',
  smallWidth: ${small},
  png: '/brand/mm-veiculos-logo.png',
  width: ${logo.width},
  height: ${logo.height},
  aspect: ${aspect.toFixed(4)},
} as const;

/** Só o traço do carro (sem o texto), da mesma logo oficial. */
export const LOGO_TRACO = {
  src: '/brand/mm-veiculos-traco.webp',
  width: ${strokes.width},
  height: ${strokes.height},
} as const;
`,
  );

  // Imagem padrão de compartilhamento: fundo escuro com brilho suave, logo ao centro e faixa dourada.
  const W = 1200;
  const H = 630;
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><radialGradient id="g" cx="50%" cy="45%" r="70%">
        <stop offset="0" stop-color="#1c1e22"/><stop offset="1" stop-color="#08090a"/>
      </radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect y="${H - 8}" width="${W}" height="8" fill="#f2c12e"/>
    </svg>`,
  );
  const ogLogoWidth = 820;
  const ogLogo = await sharp(logo.png).resize(ogLogoWidth).toBuffer();
  const ogLogoHeight = Math.round(ogLogoWidth / aspect);
  await sharp(background)
    .composite([
      { input: ogLogo, left: Math.round((W - ogLogoWidth) / 2), top: Math.round((H - ogLogoHeight) / 2) - 8 },
    ])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(path.join(ROOT, 'public/og-default.jpg'));

  console.log(
    `Logo oficial: ${logo.width}x${logo.height} (proporção ${aspect.toFixed(2)}), og-default.jpg atualizado.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
