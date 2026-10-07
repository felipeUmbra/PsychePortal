import { test, expect } from './test-fixtures';
import { CompliancePage } from './pages';

test.describe('Compliance', () => {
  let compliancePage: CompliancePage;

  test.beforeEach(async ({ page, login }) => {
    compliancePage = new CompliancePage(page);
    await login();
    await compliancePage.goto();
  });

  test('loads compliance page', async () => {
    await expect(test.page.getByText(/Conformidade|Compliance/i).first()).toBeVisible();
  });
});
