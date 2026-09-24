import { expect, test } from '@playwright/test';

/**
 * Verifica, nas larguras pedidas no projeto, que nenhuma página pública tem rolagem
 * horizontal (quebra de layout). Salva screenshots em test-results/responsive/ para revisão.
 */
const WIDTHS = [320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440, 1920];
const PAGES = ['/', '/estoque', '/ofertas', '/repasses', '/anuncie-seu-veiculo', '/empresa', '/contato', '/favoritos'];

for (const width of WIDTHS) {
  test(`sem rolagem horizontal em ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 900 });
    const vehicleHref = await (async () => {
      await page.goto('/estoque?marca=Toyota');
      return page.locator('[data-vehicle-card] h3 a').first().getAttribute('href');
    })();
    for (const path of [...PAGES, vehicleHref ?? '/estoque']) {
      await page.goto(path, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(0);
      if ([320, 390, 768, 1440].includes(width) && ['/', '/estoque', '/anuncie-seu-veiculo'].includes(path)) {
        await page.screenshot({
          path: `test-results/responsive/${width}${path.replace(/\//g, '_') || '_home'}.png`,
          fullPage: true,
        });
      }
    }
  });
}
