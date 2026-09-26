import { expect, test } from '@playwright/test';
import { answerConfirm, fakePhoto, loginAdmin, trackNativeDialogs } from './helpers';

test.describe.configure({ mode: 'serial' });

test('Home → Anuncie seu veículo → Enviar proposta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quero vender meu veículo' }).click();
  await expect(page).toHaveURL(/\/anuncie-seu-veiculo$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quer vender seu veículo?');

  // Envio sem dados mostra erros de validação
  const alert = page.locator('[data-form-alert]');
  const errorOf = (field: string) => page.locator(`[data-error-for="${field}"]`);
  await page.getByRole('button', { name: /Enviar para avaliação/ }).click();
  await expect(alert).toHaveText('Revise os 7 campos destacados.');
  await expect(errorOf('name')).toHaveText('Informe seu nome.');
  await expect(errorOf('whatsapp')).toHaveText('Informe seu WhatsApp.');

  // Cada aviso some assim que o campo é preenchido (o resumo acompanha)
  const field = (name: string) => page.getByRole('textbox', { name, exact: true });
  await field('Nome').fill('Ana Teste E2E');
  await expect(errorOf('name')).toHaveCount(0);
  await expect(field('Nome')).not.toHaveAttribute('aria-invalid');
  await expect(alert).toHaveText('Revise os 6 campos destacados.');
  // WhatsApp incompleto: ao sair do campo, o aviso passa a explicar o que falta
  await field('WhatsApp').fill('4798');
  await field('WhatsApp').blur();
  await expect(errorOf('whatsapp')).toHaveText('Informe um WhatsApp válido com DDD.');
  await field('WhatsApp').fill('47988887777');
  await expect(field('WhatsApp')).toHaveValue('(47) 98888-7777');
  await expect(errorOf('whatsapp')).toHaveCount(0);
  await page.locator('label.cat-option', { hasText: 'Carro' }).click();
  await expect(errorOf('category')).toBeHidden();
  await field('Marca').fill('Volkswagen');
  await field('Modelo').fill('Gol');
  await field('Versão').fill('1.6 MSI');
  await field('Ano de fabricação').fill('2018');
  await expect(alert).toHaveText('Revise o campo destacado.');
  await field('Ano modelo').fill('2019');
  await field('Quilometragem').fill('71000');
  await expect(field('Quilometragem')).toHaveValue('71.000');
  await page.getByRole('textbox', { name: /Preço pretendido/ }).fill('45000');

  // Foto grande (2400px) é comprimida no navegador antes do envio
  await page.locator('[data-photo-input]').setInputFiles({
    name: 'gol.jpg',
    mimeType: 'image/jpeg',
    buffer: await fakePhoto('#16a34a'),
  });
  await expect(page.locator('[data-photo-list] img')).toHaveCount(1);

  await page.getByLabel(/Autorizo a M&M Veículos/).check();
  await expect(errorOf('consent')).toBeHidden();
  await expect(alert).toBeHidden();
  // Turnstile (chave de teste da Cloudflare) gera o token automaticamente
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 });

  await page.getByRole('button', { name: /Enviar para avaliação/ }).click();
  await expect(page.getByText('Recebemos as informações!')).toBeVisible();
});

test('Admin → Proposta → Converter → Publicar', async ({ page, context }) => {
  const nativeDialogs = trackNativeDialogs(page);

  // Sem login, o painel redireciona
  await page.goto('/admin/propostas');
  await expect(page).toHaveURL(/\/admin\/login/);

  // Senha errada
  await page.getByLabel('Senha').fill('senha-errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Senha incorreta.')).toBeVisible();

  await loginAdmin(page, '/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('.stat', { hasText: 'Novas propostas' })).toContainText(/[1-9]/);

  // Cookie de sessão seguro (HttpOnly + SameSite=Strict)
  const cookie = (await context.cookies()).find((c) => c.name === 'mm_admin');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');

  await page
    .getByRole('link', { name: /Propostas/ })
    .first()
    .click();
  await page.getByRole('link', { name: /Volkswagen Gol/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Volkswagen Gol');
  await expect(page.getByText('Ana Teste E2E')).toBeVisible();

  // Botão do WhatsApp com mensagem padrão para o cliente
  const wa = (await page.getByRole('link', { name: 'Chamar no WhatsApp' }).getAttribute('href')) ?? '';
  expect(wa.startsWith('https://wa.me/5547988887777?text=')).toBe(true);
  expect(decodeURIComponent(wa)).toContain(
    'Olá, Ana. Aqui é da M&M Veículos. Recebemos as informações do seu Volkswagen Gol',
  );

  // Foto da proposta vem da rota protegida
  await expect(page.locator('img[src*="/api/admin/lead-media/sell-leads/"]').first()).toBeVisible();

  // Andamento
  await page.getByRole('button', { name: 'Contatado' }).click();
  await expect(page.getByText('Status alterado para “Contatado”.')).toBeVisible();

  // Converter em rascunho (confirmação na própria página; "Cancelar" não faz nada)
  await page.getByRole('button', { name: 'Transformar em veículo' }).click();
  await answerConfirm(page, 'Transformar em veículo?', 'Cancelar');
  await expect(page).toHaveURL(/\/admin\/propostas\//);
  await page.getByRole('button', { name: 'Transformar em veículo' }).click();
  await answerConfirm(page, 'Transformar em veículo?', 'Criar rascunho');
  await expect(page).toHaveURL(/\/admin\/veiculos\/[0-9a-f-]{36}/);
  await expect(page.getByText('Rascunho criado a partir da proposta')).toBeVisible();
  await expect(page.getByText(/é um\s+rascunho/)).toBeVisible();
  await expect(page.locator('[data-photo-list] li')).toHaveCount(1);
  await expect(page.getByLabel('Marca *')).toHaveValue('Volkswagen');

  // Ofertas e Repasses já vêm marcados; revisar, definir preço e publicar
  await expect(page.getByRole('checkbox', { name: /^Ofertas/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /^Repasses/ })).toBeChecked();
  await page.getByLabel('Preço (R$)').fill('47.900');
  await page.getByLabel('Preço anterior (R$)').fill('49.900');
  // Não há "publicar" à parte: sair de Rascunho já coloca no site.
  await expect(page.getByText('Publicado no site')).toHaveCount(0);
  await page.getByLabel('Status', { exact: true }).selectOption('available');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Alterações salvas. O veículo está no site.')).toBeVisible();
  // Saiu do rascunho: comemoração da publicação
  await expect(page.locator('[data-celebrate]')).toContainText('Publicado no site!');

  // Aparece no site público com os selos corretos
  const publicLink = page.getByRole('link', { name: 'Ver no site' }).first();
  const href = (await publicLink.getAttribute('href')) ?? '';
  expect(href).toMatch(/^\/veiculo\/volkswagen-gol-1-6-msi-2019-/);
  await page.goto(href);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gol');
  await expect(page.locator('.badge-offer').first()).toBeVisible();
  await expect(page.locator('.badge-repasse').first()).toBeVisible();
  await expect(page.getByText(/R\$\s*47\.900/).first()).toBeVisible();

  // Aparece nas abas Ofertas e Repasses
  await page.goto('/veiculos?oferta=true');
  await expect(page.getByRole('link', { name: 'Gol', exact: true })).toBeVisible();
  await page.goto('/veiculos?repasse=true');
  await expect(page.getByRole('link', { name: 'Gol', exact: true })).toBeVisible();
  expect(nativeDialogs).toEqual([]);
});

test('Admin: ações rápidas, confirmações e logout', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await loginAdmin(page, '/admin/veiculos');

  const row = page.locator('li.row', { hasText: 'Volkswagen Gol' });
  await row.getByText('Ações').click();
  await row.getByRole('menuitem', { name: 'Marcar como reservado' }).click();
  await expect(page.getByText('Veículo marcado como reservado.')).toBeVisible();
  await expect(page.locator('li.row', { hasText: 'Volkswagen Gol' }).getByText('Reservado')).toBeVisible();

  // Ação com confirmação: Esc e "Cancelar" não mudam nada; confirmar aplica.
  const gol = page.locator('li.row', { hasText: 'Volkswagen Gol' });
  await gol.getByText('Ações').click();
  await gol.getByRole('menuitem', { name: 'Marcar como vendido' }).click();
  await expect(page.getByRole('dialog', { name: 'Marcar como vendido?' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(gol.getByText('Reservado')).toBeVisible();
  await gol.getByRole('menuitem', { name: 'Marcar como vendido' }).click();
  await answerConfirm(page, 'Marcar como vendido?', 'Marcar como vendido');
  await expect(page.getByText('Veículo marcado como vendido.')).toBeVisible();

  // Configurações, Ofertas e Repasses saíram do menu (ofertas e repasses são filtros da tela Veículos)
  const menu = page.locator('.admin-sidebar nav');
  const labels = (await menu.getByRole('link').allInnerTexts()).map((text) => text.trim().split('\n')[0]?.trim());
  expect(labels).toEqual(['Dashboard', 'Veículos', 'Novo veículo', 'Propostas']);
  const settings = await page.goto('/admin/configuracoes');
  expect(settings?.status()).toBe(404);

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Sair' }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  expect(nativeDialogs).toEqual([]);
});

test('Admin: novo veículo com fotos (upload, capa, exclusão)', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await loginAdmin(page, '/admin/veiculos/novo');
  // Sair com dados digitados e não salvos pede confirmação na própria página
  await page.getByLabel('Marca *').fill('Yamaha');
  await page.locator('.admin-sidebar').getByRole('link', { name: 'Dashboard' }).click();
  await answerConfirm(page, 'Sair sem salvar?', 'Continuar aqui');
  await expect(page).toHaveURL(/\/admin\/veiculos\/novo$/);
  await page.getByLabel('Categoria *').selectOption('moto');
  await page.getByLabel('Marca *').fill('Yamaha');
  await page.getByLabel('Modelo *').fill('Fazer 250');
  await page.getByLabel('Ano de fabricação').fill('2021');
  await page.getByLabel('Ano modelo').fill('2021');
  await page.getByLabel('Preço (R$)').fill('21.500');
  await page.getByRole('button', { name: 'Salvar veículo' }).click();
  await expect(page.getByText('Veículo cadastrado! Agora adicione as fotos.')).toBeVisible();
  // Comemoração ao cadastrar (some sozinha ou com um clique)
  const celebration = page.locator('[data-celebrate]');
  await expect(celebration).toContainText('Veículo cadastrado!');
  await celebration.click();
  await expect(celebration).toHaveCount(0);

  await page.locator('[data-photo-input]').setInputFiles([
    { name: 'a.jpg', mimeType: 'image/jpeg', buffer: await fakePhoto('#ef4444') },
    { name: 'b.jpg', mimeType: 'image/jpeg', buffer: await fakePhoto('#22c55e', 1800, 2400) },
  ]);
  await expect(page.locator('[data-photo-list] li[data-photo-id]:not(.is-pending)')).toHaveCount(2, {
    timeout: 30_000,
  });

  // Segunda foto vira capa
  const second = page.locator('[data-photo-list] li').nth(1);
  const secondId = await second.getAttribute('data-photo-id');
  await second.getByRole('button', { name: 'Definir como capa' }).click();
  await expect(page.locator('[data-photo-list] li').first()).toHaveAttribute('data-photo-id', secondId ?? '');
  await page.waitForTimeout(800); // debounce do salvamento da ordem
  await page.reload();
  await expect(page.locator('[data-photo-list] li').first()).toHaveAttribute('data-photo-id', secondId ?? '');

  // Excluir foto: "Cancelar" mantém; confirmar exclui
  const photos = page.locator('[data-photo-list] li');
  await photos.nth(1).getByRole('button', { name: 'Excluir foto' }).click();
  await answerConfirm(page, 'Excluir esta foto?', 'Cancelar');
  await expect(photos).toHaveCount(2);
  await photos.nth(1).getByRole('button', { name: 'Excluir foto' }).click();
  await answerConfirm(page, 'Excluir esta foto?', 'Excluir foto');
  await expect(photos).toHaveCount(1);
  expect(nativeDialogs).toEqual([]);
});

test('Admin: cadastro com fotos na mesma tela (sem precisar salvar antes)', async ({ page }) => {
  const nativeDialogs = trackNativeDialogs(page);
  await loginAdmin(page, '/admin/veiculos/novo');

  // As fotos são escolhidas e otimizadas já na tela de cadastro
  await page.locator('[data-photo-input]').setInputFiles([
    { name: 'frente.jpg', mimeType: 'image/jpeg', buffer: await fakePhoto('#2563eb') },
    { name: 'lateral.jpg', mimeType: 'image/jpeg', buffer: await fakePhoto('#f59e0b') },
    { name: 'interior.jpg', mimeType: 'image/jpeg', buffer: await fakePhoto('#10b981') },
  ]);
  const photos = page.locator('[data-photo-list] li');
  await expect(page.locator('[data-photo-list] li[data-photo-id]:not(.is-pending)')).toHaveCount(3, {
    timeout: 30_000,
  });
  await expect(page.locator('[data-photo-count]')).toHaveText('(3/30)');

  // Escolher a capa e tirar uma foto da seleção (ainda não salva: sai sem perguntar)
  const lateral = await photos.nth(1).getAttribute('data-photo-id');
  await photos.nth(1).getByRole('button', { name: 'Definir como capa' }).click();
  await expect(photos.first()).toHaveAttribute('data-photo-id', lateral ?? '');
  await photos.nth(2).getByRole('button', { name: 'Excluir foto' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(photos).toHaveCount(2);

  // Erro de validação: os erros aparecem e as fotos escolhidas continuam na tela
  await page.getByLabel('Modelo *').fill('Saveiro');
  await page.getByRole('button', { name: 'Salvar veículo' }).click();
  await expect(page.locator('[data-form-errors]')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/veiculos\/novo$/);
  await expect(photos).toHaveCount(2);
  await expect(page.locator('[data-error-for="brand"]')).toBeVisible();

  // Corrige e salva: o veículo é criado e as fotos sobem na ordem da tela (a capa primeiro)
  await page.getByLabel('Marca *').fill('Volkswagen');
  // O aviso do campo (e o resumo no topo) some assim que ele é preenchido
  await expect(page.locator('[data-error-for="brand"]')).toBeHidden();
  await expect(page.getByLabel('Marca *')).not.toHaveAttribute('aria-invalid');
  await expect(page.locator('[data-form-errors]')).toBeHidden();
  await page.getByLabel('Ano de fabricação').fill('2018');
  await page.getByLabel('Ano modelo').fill('2019');
  await page.getByLabel('Preço (R$)').fill('58.900');
  await page.getByRole('button', { name: 'Salvar veículo' }).click();
  await expect(page).toHaveURL(/\/admin\/veiculos\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByText('Veículo cadastrado com as fotos!')).toBeVisible();
  await expect(page.locator('[data-celebrate]')).toContainText('Dados e fotos salvos.');
  await expect(page.locator('[data-photo-list] li')).toHaveCount(2);

  // No site: a primeira foto (capa) é a que foi escolhida como capa (laranja)
  const href = (await page.getByRole('link', { name: 'Ver no site' }).first().getAttribute('href')) ?? '';
  await page.goto(href);
  const cover = page.locator('[data-gallery] img').first();
  await expect(cover).toBeVisible();
  const color = await cover.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0, 4, 4);
    return Array.from(ctx?.getImageData(1, 1, 1, 1).data ?? []);
  });
  expect(color[0]).toBeGreaterThan(200); // laranja #f59e0b: muito vermelho, pouco azul
  expect(color[2]).toBeLessThan(80);
  expect(nativeDialogs).toEqual([]);
});
