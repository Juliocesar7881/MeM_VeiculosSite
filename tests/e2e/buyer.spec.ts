import { expect, test } from '@playwright/test';
import { WHATSAPP } from './helpers';

test.describe('Cliente que quer comprar', () => {
  test('Home → Estoque → Veículo → WhatsApp', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/M&M Veículos/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Seu próximo veículo');

    // Busca principal
    await page.getByPlaceholder('Qual veículo você procura?').fill('Corolla');
    await page.getByRole('button', { name: 'Buscar' }).click();
    await expect(page).toHaveURL(/\/veiculos\?q=Corolla/);
    await expect(page.getByText('1 veículo encontrado')).toBeVisible();

    // Métrica anônima de visualização enviada pela página do veículo
    const viewMetric = page.waitForResponse((res) => res.url().endsWith('/api/metrics'));
    await page.getByRole('link', { name: 'Corolla', exact: true }).click();
    await expect(page).toHaveURL(/\/veiculo\/toyota-corolla-/);
    expect((await viewMetric).status()).toBe(204);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Corolla');

    // Preço de oferta: De/Por
    await expect(page.getByText(/De\s*R\$\s*124\.900/).first()).toBeVisible();

    // CTA de WhatsApp com número oficial, título e link do veículo
    const cta = page.getByRole('link', { name: 'Tenho interesse' }).first();
    const href = (await cta.getAttribute('href')) ?? '';
    expect(href.startsWith(`https://wa.me/${WHATSAPP}?text=`)).toBe(true);
    const message = decodeURIComponent(href.split('text=')[1] ?? '');
    expect(message).toContain('Olá! Vi este veículo no site da M&M Veículos');
    expect(message).toContain('Toyota Corolla XEi 2.0 Flex 2021/2022');
    expect(message).toContain('/veiculo/toyota-corolla-');
    expect(message).not.toContain('R$');

    // Galeria: próxima foto atualiza o contador
    await page.getByRole('button', { name: 'Próxima foto' }).first().click();
    await expect(page.locator('[data-counter]')).toHaveText(/2 \/ \d+/);

    // SEO: canonical, Open Graph e JSON-LD de veículo
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/veiculo\/toyota-corolla-/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /\/og\/veiculo\/.+\.jpg$/);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join('')).toContain('"Car"');
  });

  test('foto da loja no topo da Home leva a "Sobre nós" e tem "Como chegar"', async ({ page }) => {
    await page.goto('/');
    const store = page.locator('figure.store');
    await expect(store.getByRole('img', { name: /Loja da M&M Veículos/ })).toBeVisible();
    const maps = store.getByRole('link', { name: 'Como chegar' });
    await expect(maps).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    // O link do título cobre o quadro todo: clicar no meio da foto abre "Sobre nós".
    const box = await store.locator('img').boundingBox();
    if (!box) throw new Error('foto da loja sem tamanho');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/empresa$/);
  });

  test('filtros por query string e ordenação', async ({ page }) => {
    await page.goto('/veiculos?marca=Toyota');
    await expect(page.getByText('1 veículo encontrado')).toBeVisible();
    await page.goto('/veiculos?categoria=motos');
    await expect(page.getByRole('link', { name: 'CG 160' })).toBeVisible();
    await page.goto('/veiculos?ordem=menor-preco');
    const first = page.locator('[data-vehicle-card] h3').first();
    await expect(first).toHaveText('CG 160');
  });

  test('favoritos sem login', async ({ page }) => {
    await page.goto('/veiculos?marca=Toyota');
    await page.getByRole('button', { name: /Salvar Toyota Corolla nos favoritos/ }).click();
    await expect(page.locator('header [data-fav-count]')).toHaveText('1');
    await page.goto('/favoritos');
    await expect(page.getByText('1 veículo salvo')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Corolla', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Remover Toyota Corolla dos favoritos/ }).click();
    await expect(page.getByText('Nenhum favorito ainda')).toBeVisible();
  });

  test('veículo vendido mostra "Procurando algo parecido?"', async ({ page }) => {
    await page.goto('/veiculos?status=vendido');
    await page.getByRole('link', { name: 'Civic', exact: true }).click();
    await expect(page.getByText('Procurando algo parecido?')).toBeVisible();
    const href = (await page.getByRole('link', { name: 'Procurar algo parecido' }).getAttribute('href')) ?? '';
    expect(decodeURIComponent(href)).toContain('Vi este veículo vendido no site');
  });

  test('404 para veículo inexistente', async ({ page }) => {
    const res = await page.goto('/veiculo/nao-existe-123456');
    expect(res?.status()).toBe(404);
    await expect(page.getByText('Página não encontrada')).toBeVisible();
  });
});

test.describe('Ofertas e repasses', () => {
  test('Home → Ofertas (aba do estoque)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Ver todas as ofertas' }).click();
    await expect(page).toHaveURL(/\/veiculos\?oferta=true$/);
    await expect(page).toHaveTitle('Ofertas de veículos | M&M Veículos');
    const cards = page.locator('[data-vehicle-card]');
    await expect(cards).not.toHaveCount(0);
    for (const card of await cards.all()) {
      await expect(card.locator('.badge-offer')).toBeVisible();
    }
  });

  test('Home → Repasses (aba do estoque)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Ver todos os repasses' }).click();
    await expect(page).toHaveURL(/\/veiculos\?repasse=true$/);
    await expect(page).toHaveTitle(/Veículos de repasse em Massaranduba/);
    const cards = page.locator('[data-vehicle-card]');
    await expect(cards).not.toHaveCount(0);
    for (const card of await cards.all()) {
      await expect(card.locator('.badge-repasse')).toBeVisible();
    }
    // Página do repasse deixa claro que é repasse e a mensagem menciona repasse
    await cards.first().locator('h3 a').click();
    await expect(page.getByText('Veículo de repasse')).toBeVisible();
    const href = (await page.getByRole('link', { name: 'Tenho interesse' }).first().getAttribute('href')) ?? '';
    expect(decodeURIComponent(href)).toContain('veículo de repasse');
  });
});

test.describe('Estoque com abas', () => {
  test('Todos, Ofertas e Repasses na mesma página, mantendo os filtros', async ({ page }) => {
    await page.goto('/veiculos?categoria=carros');
    const tabs = page.getByRole('navigation', { name: 'Seções de veículos' });
    await expect(tabs.getByRole('link')).toHaveCount(3);
    await expect(tabs.locator('[aria-current="page"]')).toContainText('Todos');
    await tabs.getByRole('link', { name: /Repasses/ }).click();
    await expect(page).toHaveURL(/categoria=carros/);
    await expect(page).toHaveURL(/repasse=true/);
    await expect(tabs.locator('[aria-current="page"]')).toContainText('Repasses');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Repasses');
  });

  test('endereços antigos /estoque, /ofertas e /repasses redirecionam (301)', async ({ request }) => {
    const offers = await request.get('/ofertas?categoria=carros', { maxRedirects: 0 });
    expect(offers.status()).toBe(301);
    expect(offers.headers()['location']).toBe('/veiculos?oferta=true&categoria=carros');
    const repasses = await request.get('/repasses', { maxRedirects: 0 });
    expect(repasses.status()).toBe(301);
    expect(repasses.headers()['location']).toBe('/veiculos?repasse=true');
    const estoque = await request.get('/estoque?marca=Toyota', { maxRedirects: 0 });
    expect(estoque.status()).toBe(301);
    expect(estoque.headers()['location']).toBe('/veiculos?marca=Toyota');
  });
});

test.describe('Segurança e SEO básicos', () => {
  test('headers de segurança e bloqueio de indexação fora de produção', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-robots-tag']).toContain('noindex');
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /');
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/veiculo/toyota-corolla-');
    expect(sitemap).not.toContain('hyundai-creta'); // rascunho fora do sitemap
  });

  test('painel e APIs administrativas exigem login', async ({ request }) => {
    const page = await request.get('/admin/veiculos', { maxRedirects: 0 });
    expect(page.status()).toBe(303);
    expect(page.headers()['location']).toContain('/admin/login');
    expect(page.headers()['cache-control']).toContain('no-store');
    const api = await request.delete('/api/admin/vehicles/x/images/y', {
      headers: { Origin: 'http://127.0.0.1:4322' },
    });
    expect(api.status()).toBe(401);
    const media = await request.get('/api/admin/lead-media/sell-leads/a/b.webp');
    expect(media.status()).toBe(401);
  });

  test('POST de outra origem é bloqueado (CSRF)', async ({ request }) => {
    const res = await request.post('/api/leads', {
      headers: { Origin: 'https://site-malicioso.example' },
      multipart: { name: 'x' },
    });
    expect(res.status()).toBe(403);
  });

  test('nenhuma violação de CSP nas páginas principais', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    for (const path of ['/', '/veiculos', '/veiculos?oferta=true', '/anuncie-seu-veiculo', '/favoritos', '/contato']) {
      await page.goto(path);
    }
    await page.goto('/veiculos?marca=Toyota');
    await page.locator('[data-vehicle-card] h3 a').first().click();
    await expect(page.locator('[data-gallery]')).toBeVisible();
    expect(violations).toEqual([]);
  });
});
