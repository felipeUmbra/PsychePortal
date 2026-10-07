import { test, expect } from './test-fixtures';
import { FinancePage } from './pages';

test.describe('Finance', () => {
  let financePage: FinancePage;

  test.beforeEach(async ({ page, login }) => {
    financePage = new FinancePage(page);
    await login();
    await financePage.goto();
  });

  test('loads finance page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Financeiro|Financial|Finance/i, level: 1 })).toBeVisible();
  });
});
