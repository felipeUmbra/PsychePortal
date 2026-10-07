import { Page, Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForURL(url: string | RegExp) {
    await this.page.waitForURL(url);
  }

  async getByTestId(testId: string): Promise<Locator> {
    return this.page.getByTestId(testId);
  }

  getByRole(role: string, options?: { name?: string | RegExp }) {
    return this.page.getByRole(role as any, options);
  }

  getByText(text: string | RegExp) {
    return this.page.getByText(text);
  }

  getByPlaceholder(placeholder: string | RegExp) {
    return this.page.getByPlaceholder(placeholder);
  }

  async clickAndWait(selector: string | Locator, waitFor?: string | RegExp) {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.click();
    if (waitFor) {
      await this.page.waitForURL(waitFor);
    }
  }
}

export class LoginPage extends BasePage {
  async goto() {
    await this.page.goto('/#/login');
  }

  async signInWithGoogle() {
    await this.getByRole('button', { name: /entrar com o google|sign in with google/i }).click();
    await this.waitForURL(/\/app/);
  }
}

export class PatientsPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/patients');
    await this.getByText(/Diretório de Pacientes|Patients/i).first().waitFor({ state: 'visible' });
  }

  async openAddForm() {
    await this.getByRole('button', { name: /Adicionar Novo Paciente|Add Patient/i }).click();
    await this.getByText(/Adicionar Novo Paciente|Add New Patient/i).first().waitFor({ state: 'visible' });
  }

  async fillPatientForm(data: { name: string; email: string; phone: string; birthDate?: string }) {
    await this.page.locator('#patient-name').fill(data.name);
    await this.page.locator('#patient-email').fill(data.email);
    await this.page.locator('#patient-phone').fill(data.phone);
    if (data.birthDate) {
      await this.page.locator('#patient-dob').fill(data.birthDate);
    }
  }

  async save() {
    await this.getByRole('button', { name: /Salvar|Save/i }).click();
  }

  async expectPatientVisible(name: string) {
    await expect(this.page.locator('.card', { hasText: name })).toBeVisible();
  }

  async expectPatientNotVisible(name: string) {
    await expect(this.page.locator('.card', { hasText: name })).not.toBeVisible();
  }

  async search(query: string) {
    const searchInput = this.page.locator('input[placeholder*="Pesquisar"], input[placeholder*="Search"]').first();
    await searchInput.fill(query);
  }

  async openFilters() {
    await this.getByRole('button', { name: /Filtros|Filters/i }).click();
  }

  async expectFilterOption(text: string | RegExp) {
    await expect(this.getByText(text)).toBeVisible();
  }

  async closeDropdown() {
    await this.page.locator('body').click({ position: { x: 0, y: 0 } });
  }

  async editPatient(name: string, newName: string) {
    const card = this.page.locator('.card', { hasText: name }).first();
    await card.locator('button').last().click();
    await this.getByText(/Editar|Edit/i).click();
    await this.getByText(/Editar Paciente|Edit Patient|Editar Perfil/i).first().waitFor({ state: 'visible' });
    await this.page.locator('#patient-name').fill(newName);
    await this.save();
  }

  async deletePatient(name: string) {
    const card = this.page.locator('.card', { hasText: name }).first();
    this.page.once('dialog', dialog => dialog.accept());
    await card.locator('button').last().click();
    await this.getByText(/Excluir|Delete/i).click();
    // Wait for patient to be removed
    await this.expectPatientNotVisible(name);
  }
}

export class SessionsPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/sessions');
    await this.getByRole('heading', { name: /Sessões|Sessions/i, level: 1 }).waitFor({ state: 'visible', timeout: 15000 });
  }
}

export class DashboardPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app');
    await this.page.waitForLoadState('networkidle');
    // Wait for the h1 title to be visible
    await this.getByRole('heading', { level: 1 }).waitFor({ state: 'visible', timeout: 15000 });
  }
}

export class CalendarPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/calendar');
    await this.getByText(/Calendário|Calendar/i).first().waitFor({ state: 'visible' });
  }
}

export class FinancePage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/finance');
    await this.getByRole('heading', { name: /Financeiro|Financial|Finance/i, level: 1 }).waitFor({ state: 'visible' });
  }
}

export class SettingsPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/settings');
    await this.getByText(/Configurações|Settings/i).first().waitFor({ state: 'visible' });
  }
}

export class AuditLogPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/audit');
    await this.getByText(/Audit Trail|Audit Log|Rastro de Auditoria|Log de Auditoria/i).first().waitFor({ state: 'visible' });
  }
}

export class CompliancePage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/compliance');
    await this.getByText(/Conformidade|Compliance/i).first().waitFor({ state: 'visible' });
  }
}

export class EncryptionPage extends BasePage {
  async goto() {
    await this.page.goto('/#/app/settings');
    await this.getByText(/Criptografia|Encryption/i).first().waitFor({ state: 'visible' });
  }
}

export class PatientDetailPage extends BasePage {
  async goto(patientName: string) {
    await this.page.goto(`/#/app/patients/${encodeURIComponent(patientName)}`);
    await this.getByRole('heading', { name: patientName }).waitFor({ state: 'visible', timeout: 15000 });
  }
}