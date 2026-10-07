import { test, expect } from './test-fixtures';
import { SessionsPage } from './pages';

test.describe('Sessions', () => {
  let sessionsPage: SessionsPage;

  test.beforeEach(async ({ page, login }) => {
    sessionsPage = new SessionsPage(page);
    await login();
    await sessionsPage.goto();
  });

  test('loads sessions page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Sessões|Sessions/i, level: 1 })).toBeVisible();
  });

  test.skip('can create a new session', async ({ page }) => {
    // This is a placeholder - actual implementation depends on the UI
    await expect(page.getByRole('button', { name: /Nova Sessão|New Session/i })).toBeVisible();
  });
});
