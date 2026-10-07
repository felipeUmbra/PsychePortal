import { test, expect } from './test-fixtures';
import { LoginPage } from './pages';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test('shows login page', async ({ page }) => {
    await loginPage.goto();
    await expect(page.getByRole('button', { name: /entrar com o google|sign in with google/i })).toBeVisible();
  });

  test('can sign in with Google (mocked)', async ({ page, login }) => {
    await login();
    await page.waitForURL(/\/app/);
    await expect(page.getByText(/Dashboard|Pacientes|Patients/i).first()).toBeVisible();
  });

  test('redirects to login when accessing protected route', async ({ page }) => {
    await page.goto('/#/app/patients');
    await page.waitForURL(/\/login/);
    await expect(page.getByRole('button', { name: /entrar com o google|sign in with google/i })).toBeVisible();
  });
});
