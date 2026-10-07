import { test, expect } from './test-fixtures';
import { SettingsPage } from './pages';

test.describe('Settings', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page, login }) => {
    settingsPage = new SettingsPage(page);
    await login();
    await settingsPage.goto();
  });

  test('loads settings page', async ({ page }) => {
    await expect(page.getByText(/Configurações|Settings/i).first()).toBeVisible();
  });
});
