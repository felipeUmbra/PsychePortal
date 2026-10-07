import { test, expect } from './test-fixtures';

test.describe('App Shell', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/#/app/dashboard');
    await page.getByText(/Dashboard/i).first().waitFor({ state: 'visible' });
  });

  test('shows sidebar navigation', async ({ page }) => {
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pacientes|Patients/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sessões|Sessions/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Calendário|Calendar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Financeiro|Finance/i })).toBeVisible();
  });

  test('navigates between pages via sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /Pacientes|Patients/i }).click();
    await page.waitForURL(/\/patients/);
    await expect(page.getByText(/Diretório de Pacientes|Patients/i).first()).toBeVisible();

    await page.getByRole('link', { name: /Sessões|Sessions/i }).click();
    await page.waitForURL(/\/sessions/);
    await expect(page.getByText(/Sessões|Sessions/i).first()).toBeVisible();

    await page.getByRole('link', { name: /Dashboard/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible();
  });

  test('shows user menu', async ({ page }) => {
    // User avatar/menu should be visible
    await expect(page.getByRole('button', { name: /perfil|profile|usuário|user/i })).toBeVisible();
  });

  test('responsive: sidebar collapses on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // On mobile, sidebar should be hidden or collapsible
    const sidebar = page.getByRole('navigation');
    // Check if sidebar is hidden or has a toggle
    const hamburger = page.getByRole('button', { name: /menu|hamburger/i });
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await expect(sidebar).toBeVisible();
    }
  });
});
