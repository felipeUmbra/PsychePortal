import { test, expect } from './test-fixtures';
import { EncryptionPage } from './pages';

test.describe('Encryption', () => {
  let encryptionPage: EncryptionPage;

  test.beforeEach(async ({ page, login }) => {
    encryptionPage = new EncryptionPage(page);
    await login();
    await encryptionPage.goto();
  });

  test('loads encryption page', async () => {
    await expect(test.page.getByText(/Criptografia|Encryption/i).first()).toBeVisible();
  });
});
