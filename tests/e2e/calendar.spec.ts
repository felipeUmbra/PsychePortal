import { test, expect } from './test-fixtures';
import { CalendarPage } from './pages';

test.describe('Calendar', () => {
  let calendarPage: CalendarPage;

  test.beforeEach(async ({ page, login }) => {
    calendarPage = new CalendarPage(page);
    await login();
    await calendarPage.goto();
  });

  test('loads calendar page', async () => {
    await expect(test.page.getByText(/Calendário|Calendar/i).first()).toBeVisible();
  });
});
