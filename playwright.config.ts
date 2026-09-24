import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4322);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
// Usa o navegador já instalado (Edge/Chrome) — não é preciso baixar navegadores.
const channel = process.env.E2E_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome');
// Alternativa: caminho de um Chromium já instalado (ex.: CI/containers). Tem prioridade sobre o canal.
const executablePath = process.env.E2E_EXECUTABLE_PATH;
const browser = executablePath ? { launchOptions: { executablePath } } : { channel };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    ...browser,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], ...browser, viewport: { width: 1440, height: 900 } },
      testIgnore: /mobile\.spec/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], ...browser }, testMatch: /mobile\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx tsx scripts/e2e-server.ts',
        url: `${baseURL}/robots.txt`,
        reuseExistingServer: false,
        timeout: 180_000,
        stdout: 'pipe',
      },
});
