// Configuração dos testes de navegador (npm test). Só Chromium, para manter o CI leve.
// Dois perfis: desktop em português e um telemóvel em inglês, para cobrir o idioma por defeito,
// a largura móvel e o toque. O servidor de testes é o mesmo tools/serve.mjs do desenvolvimento,
// numa porta própria, e o global-setup gera o ficheiro único (dist/) antes de tudo.
import { defineConfig, devices } from '@playwright/test';

const PORT = 8778;

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/global-setup.mjs',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    { name: 'desktop-pt', use: { ...devices['Desktop Chrome'], locale: 'pt-PT', viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-en', use: { ...devices['Pixel 5'], locale: 'en-GB' } },
  ],
  webServer: {
    command: `node tools/serve.mjs --port ${PORT} --cache`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
