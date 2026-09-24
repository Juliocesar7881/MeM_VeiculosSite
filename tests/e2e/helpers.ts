import { expect, type Page } from '@playwright/test';
import sharp from 'sharp';

export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-senha-de-teste-123';
export const WHATSAPP = '554896410338';

export async function loginAdmin(page: Page, next = '/admin') {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Senha').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[?]/g, '\\?')}$`));
}

/** Foto JPEG gerada na hora (simula uma foto de celular). */
export async function fakePhoto(color = '#3b82f6', width = 2400, height = 1800): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export function acceptDialogs(page: Page) {
  page.on('dialog', (dialog) => void dialog.accept());
}
