import { test, expect } from './test-fixtures';
import { DashboardPage } from './pages';

test.describe('Dashboard', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page, login }) => {
    dashboardPage = new DashboardPage(page);
    await login();
    await dashboardPage.goto();
  });

  test('loads dashboard page', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test.skip('shows key metrics', async ({ page }) => {
    await expect(page.getByText(/Total Patients|Total de Pacientes/i)).toBeVisible();
    await expect(page.getByText(/Total Sessions|Total de Sessões/i)).toBeVisible();
  });
});
