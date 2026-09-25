import { expect, test } from '@playwright/test';
import { acceptDialogs, fakePhoto, loginAdmin } from './helpers';

test.describe.configure({ mode: 'serial' });

test('Home → Anuncie seu veículo → Enviar proposta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Quero vender meu veículo' }).click();
  await expect(page).toHaveURL(/\/anuncie-seu-veiculo$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quer vender seu veículo?');

  // Envio sem dados mostra erros de validação
  await page.getByRole('button', { name: /Enviar para avaliação/ }).click();
  await expect(page.locator('[data-form-alert]')).toBeVisible();

  const field = (name: string) => page.getByRole('textbox', { name, exact: true });
  await field('Nome').fill('Ana Teste E2E');
  await field('WhatsApp').fill('47988887777');
  await expect(field('WhatsApp')).toHaveValue('(47) 98888-7777');
  await page.locator('label.cat-option', { hasText: 'Carro' }).click();
  await field('Marca').fill('Volkswagen');
  await field('Modelo').fill('Gol');
  await field('Versão').fill('1.6 MSI');
  await field('Ano de fabricação').fill('2018');
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
  // Turnstile (chave de teste da Cloudflare) gera o token automaticamente
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 });

  await page.getByRole('button', { name: /Enviar para avaliação/ }).click();
  await expect(page.getByText('Recebemos as informações!')).toBeVisible();
});

test('Admin → Proposta → Converter → Publicar', async ({ page, context }) => {
  acceptDialogs(page);

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

  // Converter em rascunho
  await page.getByRole('button', { name: 'Transformar em veículo' }).click();
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
  await page.getByText('Publicado no site', { exact: true }).click();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Alterações salvas.')).toBeVisible();

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
});

test('Admin: ações rápidas, configurações e logout', async ({ page }) => {
  acceptDialogs(page);
  await loginAdmin(page, '/admin/veiculos');

  const row = page.locator('li.row', { hasText: 'Volkswagen Gol' });
  await row.getByText('Ações').click();
  await row.getByRole('menuitem', { name: 'Marcar como reservado' }).click();
  await expect(page.getByText('Veículo marcado como reservado.')).toBeVisible();
  await expect(page.locator('li.row', { hasText: 'Volkswagen Gol' }).getByText('Reservado')).toBeVisible();

  // Configurações: altera o texto do botão e confere no site
  await page.goto('/admin/configuracoes');
  await page.getByLabel('Texto do botão “Anuncie seu veículo”').fill('Venda seu carro');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(page.getByText(/Configurações salvas/)).toBeVisible();
  await page.goto('/');
  await expect(page.locator('header').getByRole('link', { name: 'Venda seu carro' })).toBeVisible();

  // Restaura
  await page.goto('/admin/configuracoes');
  await page.getByLabel('Texto do botão “Anuncie seu veículo”').fill('Anuncie seu veículo');
  await page.getByRole('button', { name: 'Salvar configurações' }).click();

  await page.getByRole('button', { name: 'Sair' }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('Admin: novo veículo com fotos (upload, capa, exclusão)', async ({ page }) => {
  acceptDialogs(page);
  await loginAdmin(page, '/admin/veiculos/novo');
  await page.getByLabel('Categoria *').selectOption('moto');
  await page.getByLabel('Marca *').fill('Yamaha');
  await page.getByLabel('Modelo *').fill('Fazer 250');
  await page.getByLabel('Ano de fabricação').fill('2021');
  await page.getByLabel('Ano modelo').fill('2021');
  await page.getByLabel('Preço (R$)').fill('21.500');
  await page.getByRole('button', { name: /Salvar e adicionar fotos/ }).click();
  await expect(page.getByText('Veículo cadastrado! Agora adicione as fotos.')).toBeVisible();

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

  // Excluir foto
  await page.locator('[data-photo-list] li').nth(1).getByRole('button', { name: 'Excluir foto' }).click();
  await expect(page.locator('[data-photo-list] li')).toHaveCount(1);
});
