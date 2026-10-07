import { test, expect } from './test-fixtures';
import { PatientsPage } from './pages';

test.describe('Persistence & Sync', () => {
  let patientsPage: PatientsPage;

  test.beforeEach(async ({ page, login }) => {
    patientsPage = new PatientsPage(page);
    await login();
    await patientsPage.goto();
  });

  test('patient data persists after reload', async ({ page }) => {
    await patientsPage.openAddForm();
    await patientsPage.fillPatientForm({
      name: 'Persistent Patient',
      email: 'persistent@test.com',
      phone: '11999997777',
      birthDate: '1990-01-01'
    });
    await patientsPage.save();
    await patientsPage.expectPatientVisible('Persistent Patient');

    // Reload the page
    await page.reload();
    await patientsPage.goto();
    await patientsPage.expectPatientVisible('Persistent Patient');
  });

  test('patient data persists after navigation', async ({ page }) => {
    await patientsPage.openAddForm();
    await patientsPage.fillPatientForm({
      name: 'Nav Patient',
      email: 'nav@test.com',
      phone: '11999996666',
      birthDate: '1990-01-01'
    });
    await patientsPage.save();
    await patientsPage.expectPatientVisible('Nav Patient');

    // Navigate away and back
    await page.getByRole('link', { name: /Dashboard/i }).click();
    await page.waitForURL(/\/dashboard/);
    await page.getByRole('link', { name: /Pacientes|Patients/i }).click();
    await patientsPage.goto();
    await patientsPage.expectPatientVisible('Nav Patient');
  });
});
