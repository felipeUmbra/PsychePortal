import { test, expect } from './test-fixtures';
import { FinancePage } from './pages';

test.describe('Finance', () => {
  let financePage: FinancePage;

  test.beforeEach(async ({ page, login }) => {
    financePage = new FinancePage(page);
    await login();
    await financePage.goto();
  });

  test('loads finance page', async () => {
    await expect(test.page.getByText(/Financeiro|Finance/i).first()).toBeVisible();
  });
});
