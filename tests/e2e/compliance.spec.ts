import { test, expect } from './test-fixtures';
import { CompliancePage } from './pages';

test.describe('Compliance', () => {
  let compliancePage: CompliancePage;

  test.beforeEach(async ({ page, login }) => {
    compliancePage = new CompliancePage(page);
    await login();
    await compliancePage.goto();
  });

  test('loads compliance page', async ({ page }) => {
    await expect(page.getByText(/Conformidade|Compliance/i).first()).toBeVisible();
  });
});
