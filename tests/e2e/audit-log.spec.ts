import { test, expect } from './test-fixtures';
import { AuditLogPage } from './pages';

test.describe('Audit Log', () => {
  let auditLogPage: AuditLogPage;

  test.beforeEach(async ({ page, login }) => {
    auditLogPage = new AuditLogPage(page);
    await login();
    await auditLogPage.goto();
  });

  test('loads audit log page', async () => {
    await expect(test.page.getByText(/Log de Auditoria|Audit Log/i).first()).toBeVisible();
  });
});
