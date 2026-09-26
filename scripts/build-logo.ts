/**
 * Gera a versão técnica (vetorial, fundo transparente) da logo oficial da M&M Veículos
 * a partir da referência em docs/brand/. O texto é convertido em curvas (não depende de
 * fonte instalada) e os traços do veículo são redesenhados fielmente à logo original.
 *
 * A logo exibida no site agora é a OFICIAL enviada pela loja (scripts/build-logo-oficial.ts). Este
 * script gera só o que precisa ser vetorial: os traços decorativos e os ícones quadrados.
 *
 * Saídas:
 *  - src/components/brand/logo-data.ts  (traços usados no fundo "Fotos em breve" e na chamada "Anuncie")
 *  - public/favicon.svg, ícones PWA e apple-touch-icon
 *
 * Uso: npm run brand:logo (roda os dois scripts)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

const ROOT = process.cwd();
const GOLD = '#F2C12E';
const SILVER_STOPS = [
  { offset: 0, color: '#9C9C9C' },
  { offset: 0.35, color: '#F4F4F4' },
  { offset: 0.8, color: '#FFFFFF' },
  { offset: 1, color: '#B8B8B8' },
];
const BLACK = '#08090A';

// Espaço de coordenadas baseado na referência ampliada (docs/brand/logo-referencia-ampliada.png).
const VIEWBOX = { x: 56, y: 92, width: 892, height: 200 };

/** Linha dourada: capô + teto + caimento traseiro (forma fechada, afunilada nas pontas). */
const GOLD_SWOOSH = [
  'M 64 150',
  'C 112 161 176 166 240 157',
  'C 310 147 374 103 452 100',
  'C 534 97 606 124 654 162',
  'C 598 138 532 120 458 120',
  'C 386 121 328 156 258 173',
  'C 194 187 128 185 94 173',
  'Z',
].join(' ');

/** Pequeno detalhe frontal (para-choque) que desce da ponta do capô. */
const GOLD_NOSE = ['M 80 160', 'C 95 172 105 189 108 210', 'C 97 193 85 179 64 161', 'Z'].join(' ');

/** Linha prateada: lateral/traseira do veículo. */
const SILVER_SWOOSH = ['M 420 176', 'C 556 160 776 162 938 211', 'C 774 184 562 188 420 182', 'Z'].join(' ');

const TEXT = 'M&M VEÍCULOS';
const TEXT_BOX = { left: 132, right: 882, baseline: 282, capHeight: 57 };

type Font = opentype.Font;

/** opentype.js 2.x aceita opções (flipY) em toPathData; os tipos publicados são da 1.x. */
function pathData(path: opentype.Path): string {
  const withOptions = path as unknown as { toPathData(options: { decimalPlaces: number; flipY: boolean }): string };
  return withOptions.toPathData({ decimalPlaces: 2, flipY: false });
}

/** A logo original usa um slab serif bem largo; alargamos horizontalmente as letras. */
const TEXT_X_SCALE = 1.16;

function layoutText(font: Font, text: string, tracking: number, fontSize: number, xScale = 1) {
  const scale = fontSize / font.unitsPerEm;
  // charToGlyph evita o processamento de features OpenType (ccmp) não suportado pelo opentype.js
  const glyphs = [...text].map((char) => font.charToGlyph(char));
  const pathObj = new opentype.Path();
  let x = 0;
  glyphs.forEach((glyph, index) => {
    const glyphPath = glyph.getPath(x, 0, fontSize);
    const origin = x;
    for (const cmd of glyphPath.commands) {
      if ('x' in cmd) cmd.x = origin + (cmd.x - origin) * xScale;
      if ('x1' in cmd) cmd.x1 = origin + (cmd.x1 - origin) * xScale;
      if ('x2' in cmd) cmd.x2 = origin + (cmd.x2 - origin) * xScale;
    }
    pathObj.extend(glyphPath);
    const next = glyphs[index + 1];
    const kerning = next ? font.getKerningValue(glyph, next) * scale : 0;
    x += ((glyph.advanceWidth ?? 0) * scale + kerning) * xScale + tracking;
  });
  return pathObj;
}

function buildTextPath(font: Font): string {
  const capHeightUnits = font.tables.os2?.sCapHeight ?? font.unitsPerEm * 0.7;
  const fontSize = (TEXT_BOX.capHeight / capHeightUnits) * font.unitsPerEm;
  const targetWidth = TEXT_BOX.right - TEXT_BOX.left;
  let tracking = 0;
  for (let i = 0; i < 4; i += 1) {
    const box = layoutText(font, TEXT, tracking, fontSize, TEXT_X_SCALE).getBoundingBox();
    const width = box.x2 - box.x1;
    tracking += (targetWidth - width) / (TEXT.length - 1);
  }
  const final = layoutText(font, TEXT, tracking, fontSize, TEXT_X_SCALE);
  const box = final.getBoundingBox();
  const dx = TEXT_BOX.left - box.x1;
  const dy = TEXT_BOX.baseline;
  for (const cmd of final.commands) {
    if ('x' in cmd) {
      cmd.x += dx;
      cmd.y += dy;
    }
    if ('x1' in cmd) {
      cmd.x1 += dx;
      cmd.y1 += dy;
    }
    if ('x2' in cmd) {
      cmd.x2 += dx;
      cmd.y2 += dy;
    }
  }
  return pathData(final);
}

function silverGradient(id: string) {
  const stops = SILVER_STOPS.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
  return `<linearGradient id="${id}" x1="424" y1="0" x2="934" y2="0" gradientUnits="userSpaceOnUse">${stops}</linearGradient>`;
}

function logoSvg(textPath: string, opts: { textColor?: string; background?: string } = {}) {
  const { x, y, width, height } = VIEWBOX;
  const bg = opts.background
    ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${opts.background}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" role="img" aria-label="M&amp;M Veículos">
<title>M&amp;M Veículos</title>
<defs>${silverGradient('mm-silver')}</defs>
${bg}
<path d="${GOLD_SWOOSH}" fill="${GOLD}"/>
<path d="${GOLD_NOSE}" fill="${GOLD}"/>
<path d="${SILVER_SWOOSH}" fill="url(#mm-silver)"/>
<path d="${textPath}" fill="${opts.textColor ?? GOLD}"/>
</svg>
`;
}

/** Ícone quadrado: traço do veículo + "M&M". */
function iconSvg(font: Font, size: number, opts: { rounded: boolean }) {
  const monogram = layoutText(font, 'M&M', 0, 100, TEXT_X_SCALE);
  const box = monogram.getBoundingBox();
  const mw = box.x2 - box.x1;
  const target = 300;
  const s = target / mw;
  const tx = (512 - target) / 2 - box.x1 * s;
  const ty = 330 - box.y2 * s;
  const monoPath = pathData(monogram);
  // Swoosh reposicionado dentro do quadrado 512x512
  const swooshScale = 0.5;
  const sx = 256 - ((66 + 934) / 2) * swooshScale;
  const sy = 205 - 150 * swooshScale;
  const radius = opts.rounded ? 104 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
<defs>${silverGradient('mm-silver-i')}</defs>
<rect width="512" height="512" rx="${radius}" fill="${BLACK}"/>
<g transform="translate(${sx.toFixed(2)} ${sy.toFixed(2)}) scale(${swooshScale})">
<path d="${GOLD_SWOOSH}" fill="${GOLD}"/>
<path d="${GOLD_NOSE}" fill="${GOLD}"/>
<path d="${SILVER_SWOOSH}" fill="url(#mm-silver-i)"/>
</g>
<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
<path d="${monoPath}" fill="${GOLD}"/>
</g>
</svg>
`;
}

async function loadFont(file: string): Promise<Font> {
  const buf = await readFile(path.join(ROOT, 'node_modules/@fontsource/roboto-slab/files', file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

async function main() {
  const font = await loadFont('roboto-slab-latin-900-normal.woff');
  const textPath = buildTextPath(font);

  const outComponents = path.join(ROOT, 'src/components/brand');
  await mkdir(outComponents, { recursive: true });

  const data = `// Arquivo gerado por scripts/build-logo.ts — não editar manualmente.
export const LOGO_VIEWBOX = '${VIEWBOX.x} ${VIEWBOX.y} ${VIEWBOX.width} ${VIEWBOX.height}';
export const LOGO_ASPECT = ${(VIEWBOX.width / VIEWBOX.height).toFixed(4)};
export const LOGO_GOLD_PATHS = ${JSON.stringify([GOLD_SWOOSH, GOLD_NOSE])} as const;
export const LOGO_SILVER_PATH = ${JSON.stringify(SILVER_SWOOSH)};
export const LOGO_SILVER_STOPS = ${JSON.stringify(SILVER_STOPS)} as const;
export const LOGO_TEXT_PATH = ${JSON.stringify(textPath)};
`;
  await writeFile(path.join(outComponents, 'logo-data.ts'), data);

  // Ícones
  const icon = iconSvg(font, 512, { rounded: true });
  const iconSquare = iconSvg(font, 512, { rounded: false });
  await writeFile(path.join(ROOT, 'public/favicon.svg'), icon);
  await sharp(Buffer.from(icon)).resize(32, 32).png().toFile(path.join(ROOT, 'public/favicon-32.png'));
  await sharp(Buffer.from(iconSquare)).resize(180, 180).png().toFile(path.join(ROOT, 'public/apple-touch-icon.png'));
  await sharp(Buffer.from(icon)).resize(192, 192).png().toFile(path.join(ROOT, 'public/icon-192.png'));
  await sharp(Buffer.from(icon)).resize(512, 512).png().toFile(path.join(ROOT, 'public/icon-512.png'));
  await sharp(Buffer.from(iconSquare)).resize(512, 512).png().toFile(path.join(ROOT, 'public/icon-maskable-512.png'));

  // Pré-visualização para conferência com a referência
  const previewDir = path.join(ROOT, 'docs/brand');
  await sharp(Buffer.from(logoSvg(textPath, { background: '#000000' })), { density: 150 })
    .resize({ width: 1020 })
    .png()
    .toFile(path.join(previewDir, 'logo-recriada-preview.png'));

  console.log('Logo e ícones gerados com sucesso.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
