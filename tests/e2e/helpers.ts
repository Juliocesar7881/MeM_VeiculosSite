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

/**
 * O painel nunca pode usar caixas do navegador (confirm/alert/"sair da página?"): as confirmações
 * são desenhadas na própria página. Retorna a lista das que apareceram (deve ficar vazia).
 */
export function trackNativeDialogs(page: Page): string[] {
  const seen: string[] = [];
  page.on('dialog', (dialog) => {
    seen.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return seen;
}

/** Confirma (ou cancela) o diálogo de confirmação do painel. */
export async function answerConfirm(page: Page, title: RegExp | string, button: string) {
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
