import { test, expect } from './test-fixtures';

test.describe('App Shell', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/#/app');
    await page.getByText(/Dashboard/i).first().waitFor({ state: 'visible' });
  });

  test('shows sidebar navigation', async ({ page, isMobile }) => {
    if (isMobile) {
      await page.locator('button[aria-controls="sidebar-nav"]').click();
    }
    const nav = page.getByRole('navigation');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: /Dashboard/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Pacientes|Patients/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Sessões|Sessions/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Calendário|Calendar/i })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Financeiro|Financial|Finance/i })).toBeVisible();
  });

  test('navigates between pages via sidebar', async ({ page, isMobile }) => {
    const nav = page.getByRole('navigation');
    if (isMobile) {
      await page.locator('button[aria-controls="sidebar-nav"]').click();
    }
    await nav.getByRole('link', { name: /Pacientes|Patients/i }).click();
    await page.waitForURL(/\/patients/);
    await expect(page.getByRole('heading', { name: /Diretório de Pacientes|Patients/i, level: 1 })).toBeVisible();

    if (isMobile) {
      await page.locator('button[aria-controls="sidebar-nav"]').click();
    }
    await nav.getByRole('link', { name: /Sessões|Sessions/i }).click();
    await page.waitForURL(/\/sessions/);
    await expect(page.getByRole('heading', { name: /Sessões|Sessions/i, level: 1 })).toBeVisible();

    if (isMobile) {
      await page.locator('button[aria-controls="sidebar-nav"]').click();
    }
    await nav.getByRole('link', { name: /Dashboard/i }).click();
    await page.waitForURL(/\/app(\/|$)/);
    await expect(page.getByRole('heading', { name: /Dashboard/i, level: 1 })).toBeVisible();
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
    const hamburger = page.locator('button[aria-controls="sidebar-nav"]');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await expect(sidebar).toBeVisible();
    }
  });
});
