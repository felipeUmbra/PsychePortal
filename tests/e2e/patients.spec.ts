import { test, expect } from './test-fixtures';
import { PatientsPage } from './pages';

const PATIENT = {
  name: 'John Doe',
  email: 'john.doe@test.com',
  phone: '11999998888',
};

test.describe('Patients Directory', () => {
  let patientsPage: PatientsPage;

  test.beforeEach(async ({ page, login }) => {
    patientsPage = new PatientsPage(page);
    await login();
    await patientsPage.goto();
  });

  test('creates a new patient', async () => {
    await patientsPage.openAddForm();
    await patientsPage.fillPatientForm({ ...PATIENT, birthDate: '1990-01-01' });
    await patientsPage.save();

    await patientsPage.expectPatientVisible(PATIENT.name);
    await patientsPage.expectPatientVisible(PATIENT.email);
  });

  test('searches patients by name', async () => {
    await patientsPage.openAddForm();
    await patientsPage.fillPatientForm({ ...PATIENT, birthDate: '1990-01-01' });
    await patientsPage.save();
    await patientsPage.expectPatientVisible(PATIENT.name);

    await patientsPage.search(PATIENT.name);
    await patientsPage.expectPatientVisible(PATIENT.name);

    await patientsPage.search('Nonexistent Patient XYZ');
    await patientsPage.expectPatientNotVisible(PATIENT.name);
  });

  test('shows financial plan filter options', async () => {
    await patientsPage.openFilters();
    await patientsPage.expectFilterOption(/Plano Financeiro|Financial Plan/i);
    await patientsPage.closeDropdown();
  });

  test('edits an existing patient', async () => {
    await patientsPage.openAddForm();
    await patientsPage.fillPatientForm({ ...PATIENT, birthDate: '1990-01-01' });
    await patientsPage.save();
    await patientsPage.expectPatientVisible(PATIENT.name);

    await patientsPage.editPatient(PATIENT.name, 'John Doe Updated');
    await patientsPage.expectPatientVisible('John Doe Updated');
  });

  test('deletes a patient after confirmation', async () => {
    await patientsPage.openAddForm();
    await patientsPage.fillPatientForm({ ...PATIENT, birthDate: '1990-01-01' });
    await patientsPage.save();
    await patientsPage.expectPatientVisible(PATIENT.name);

    await patientsPage.deletePatient(PATIENT.name);
    await patientsPage.expectPatientNotVisible(PATIENT.name);
  });
});
