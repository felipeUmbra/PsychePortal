import { test, expect } from './test-fixtures';
import { SettingsPage } from './pages';

test.describe('Settings', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page, login }) => {
    settingsPage = new SettingsPage(page);
    await login();
    await settingsPage.goto();
  });

  test('loads settings page', async () => {
    await expect(test.page.getByText(/Configurações|Settings/i).first()).toBeVisible();
  });
});
