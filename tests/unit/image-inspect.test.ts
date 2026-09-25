import { describe, expect, it } from 'vitest';
import { vehicleSrcset } from '@/lib/storage/keys';
import { validateImagePair, validateMediumImage, validateOgImage } from '@/services/media-service';
import { detectImageFormat, ImageValidationError, inspectImage, readImageDimensions } from '@/utils/image-inspect';
import { makeImage, makePair } from '../helpers/images';

describe('detecção de formato e dimensões', () => {
  it.each(['webp', 'jpeg', 'png'] as const)('%s', async (format) => {
    const bytes = await makeImage(801, 533, format);
    expect(detectImageFormat(bytes)).toBe(format);
    expect(readImageDimensions(bytes, format)).toEqual({ width: 801, height: 533 });
  });

  it('WebP lossless (VP8L) também é lido', async () => {
    const sharp = (await import('sharp')).default;
    const buf = await sharp({ create: { width: 321, height: 241, channels: 4, background: '#000' } })
      .webp({ lossless: true })
      .toBuffer();
    expect(readImageDimensions(new Uint8Array(buf), 'webp')).toEqual({ width: 321, height: 241 });
  });

  it('rejeita arquivos que não são imagem', () => {
    const fake = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    expect(detectImageFormat(fake)).toBeNull();
    expect(() => inspectImage(fake, { maxBytes: 1000, maxEdge: 2000 })).toThrow(ImageValidationError);
  });

  it('respeita limites de bytes, dimensão e formatos permitidos', async () => {
    const png = await makeImage(400, 300, 'png');
    expect(() => inspectImage(png, { maxBytes: 1_000_000, maxEdge: 2000 })).toThrow(/Formato/);
    const big = await makeImage(3000, 2000, 'webp');
    expect(() => inspectImage(big, { maxBytes: 5_000_000, maxEdge: 1928 })).toThrow(/Dimensões/);
    expect(() => inspectImage(big, { maxBytes: 10, maxEdge: 5000 })).toThrow(/grande/);
  });
});

describe('validateImagePair', () => {
  const limits = { largeMaxBytes: 1_200_000, thumbMaxBytes: 250_000, largeMaxEdge: 1920, thumbMaxEdge: 720 };

  it('aceita par consistente', async () => {
    const pair = await makePair();
    const result = validateImagePair(pair, limits);
    expect(result.large.width).toBe(1600);
    expect(result.thumb.width).toBe(720);
  });

  it('rejeita miniatura com proporção diferente', async () => {
    const pair = { large: await makeImage(1600, 1200), thumb: await makeImage(720, 720) };
    expect(() => validateImagePair(pair, limits)).toThrow(/proporção/);
  });

  it('rejeita fotos pequenas demais', async () => {
    const pair = { large: await makeImage(300, 200), thumb: await makeImage(300, 200) };
    expect(() => validateImagePair(pair, limits)).toThrow(/pequena/);
  });

  it('o tamanho mínimo vale em pé ou deitada (320×240 ou 240×320)', async () => {
    const standing = { large: await makeImage(240, 320), thumb: await makeImage(240, 320) };
    expect(validateImagePair(standing, limits).large.height).toBe(320);
    const narrow = { large: await makeImage(200, 400), thumb: await makeImage(200, 400) };
    expect(() => validateImagePair(narrow, limits)).toThrow(/pequena/);
  });
});

describe('validateMediumImage / validateOgImage', () => {
  it('aceita versão média consistente com a grande', async () => {
    const { large } = validateImagePair(await makePair(), {
      largeMaxBytes: 1_200_000,
      thumbMaxBytes: 250_000,
      largeMaxEdge: 1920,
      thumbMaxEdge: 720,
    });
    expect(validateMediumImage(await makeImage(1080, 810), large).width).toBe(1080);
    const square = await makeImage(1080, 1080);
    expect(() => validateMediumImage(square, large)).toThrow(/proporção/);
    const tooBig = await makeImage(1600, 1200);
    expect(() => validateMediumImage(tooBig, large)).toThrow(/Dimensões/);
  });

  it('imagem de compartilhamento precisa ser JPEG 1200x630', async () => {
    expect(validateOgImage(await makeImage(1200, 630, 'jpeg')).width).toBe(1200);
    const webp = await makeImage(1200, 630, 'webp');
    expect(() => validateOgImage(webp)).toThrow(/Formato/);
    const narrow = await makeImage(1000, 630, 'jpeg');
    expect(() => validateOgImage(narrow)).toThrow(/1200/);
  });
});

describe('vehicleSrcset', () => {
  const base = { thumbKey: 'vehicles/a/b-thumb.webp', thumbWidth: 720, largeKey: 'vehicles/a/b.webp', width: 1920 };

  it('inclui a versão média apenas quando existe', () => {
    expect(vehicleSrcset(base)).toBe('/media/vehicles/a/b-thumb.webp 720w, /media/vehicles/a/b.webp 1920w');
    expect(vehicleSrcset({ ...base, mediumKey: 'vehicles/a/b-md.webp', mediumWidth: 1080 })).toBe(
      '/media/vehicles/a/b-thumb.webp 720w, /media/vehicles/a/b-md.webp 1080w, /media/vehicles/a/b.webp 1920w',
    );
  });
});
