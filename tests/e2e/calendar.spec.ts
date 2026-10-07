import { test, expect } from './test-fixtures';
import { CalendarPage } from './pages';

test.describe('Calendar', () => {
  let calendarPage: CalendarPage;

  test.beforeEach(async ({ page, login }) => {
    calendarPage = new CalendarPage(page);
    await login();
    await calendarPage.goto();
  });

  test('loads calendar page', async ({ page }) => {
    await expect(page.getByText(/Calendário|Calendar/i).first()).toBeVisible();
  });
});
