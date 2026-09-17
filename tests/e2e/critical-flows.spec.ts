import { expect, test } from '@playwright/test';

const ADMIN = { email: 'admin@emcosalud.com', password: 'Admin12345!' };

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(ADMIN.email);
  await page.getByLabel('Contraseña').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/admin');
}

test('rutas protegidas: sin sesión redirige a login', async ({ page }) => {
  await page.goto('/admin/portales');
  await expect(page).toHaveURL(/\/login/);
});

test('login y dashboard', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Estadísticas por portal')).toBeVisible();
});

test('crear un portal', async ({ page }) => {
  await login(page);
  await page.goto('/admin/portales');
  await page.getByRole('button', { name: 'Nuevo portal' }).click();

  await page.getByLabel('Nombre', { exact: true }).fill('Farmacia EMCO');
  await page.getByLabel('Nombre corto').fill('Farmacia');
  await page.getByLabel('Slug').fill('farmacia-e2e');
  await page.getByLabel('URL del sitio').fill('https://farmacia.emcosalud.com');
  await page.getByRole('button', { name: 'Crear portal' }).click();

  await expect(page.getByText('Portal creado')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Farmacia EMCO' })).toBeVisible();
});

test('crear un boletín multiportal (General)', async ({ page }) => {
  await login(page);
  await page.goto('/admin/boletines');
  await page.getByRole('button', { name: 'Nuevo boletín' }).click();

  await page.getByLabel('Título').fill('Boletín E2E');
  await page.getByLabel('General').check();
  await page.getByRole('checkbox', { name: 'EMCOSALUD' }).check();
  await page.getByRole('checkbox', { name: 'Clínica Emcosalud' }).check();
  await page.getByRole('button', { name: 'Crear boletín' }).click();

  await expect(page.getByText('Boletín creado')).toBeVisible();
  await expect(page.getByText(/General · EMCOSALUD, Clínica Emcosalud/)).toBeVisible();
});
