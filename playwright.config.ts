import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas E2E de los flujos críticos. Requiere navegadores instalados:
 *   npx playwright install chromium
 *
 * Levanta el servidor de desarrollo con la base embebida (PGlite) ya sembrada.
 * Ejecuta: `npm run test:e2e`
 */
const PORT = 4331;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run db:reset && npm run dev -- --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DB_DRIVER: 'pglite',
      STORAGE_DRIVER: 'fs',
      STORAGE_PUBLIC_URL: `http://127.0.0.1:${PORT}/media`,
      SEED_SUPERADMIN_EMAIL: 'admin@emcosalud.com',
      SEED_SUPERADMIN_PASSWORD: 'Admin12345!',
      AUTH_SECRET: 'e2e_secret_only_for_playwright_runs_32b',
    },
  },
});
