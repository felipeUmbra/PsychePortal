import { test, expect } from './test-fixtures';
import { EncryptionPage } from './pages';

test.describe('Encryption', () => {
  let encryptionPage: EncryptionPage;

  test.beforeEach(async ({ page, login }) => {
    encryptionPage = new EncryptionPage(page);
    await login();
    await encryptionPage.goto();
  });

  test('loads encryption section', async ({ page }) => {
    await expect(page.getByText(/Criptografia|Encryption/i).first()).toBeVisible();
  });
});
