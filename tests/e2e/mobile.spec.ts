import { expect, test } from '@playwright/test';

test.describe('Experiência no celular', () => {
  test('menu hamburger, barra inferior e CTA "Anunciar"', async ({ page }) => {
    await page.goto('/');
    const tabbar = page.getByRole('navigation', { name: 'Navegação rápida' });
    await expect(tabbar).toBeVisible();
    await expect(tabbar.getByRole('link', { name: 'Anunciar' })).toBeVisible();

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Anuncie seu veículo' })).toBeVisible();
    await menu.getByRole('link', { name: 'Sobre nós' }).click();
    await expect(page).toHaveURL(/\/empresa$/);
  });

  test('filtros abrem em gaveta', async ({ page }) => {
    await page.goto('/veiculos');
    await page.getByRole('button', { name: /Filtros/ }).click();
    const panel = page.locator('[data-filter-panel]');
    await expect(panel).toHaveClass(/is-open/);
    await panel.getByLabel('Categoria').selectOption('motos');
    await panel.getByRole('button', { name: 'Ver resultados' }).click();
    await expect(page).toHaveURL(/categoria=motos/);
    expect(page.url()).not.toContain('marca=&');
  });

  test('página do veículo tem barra fixa com WhatsApp', async ({ page }) => {
    await page.goto('/veiculos?marca=Toyota');
    await page.getByRole('link', { name: 'Corolla', exact: true }).click();
    const bar = page.locator('.mobile-cta');
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('link', { name: /Tenho interesse/ })).toHaveAttribute('href', /wa\.me\/554896410338/);
  });
});
