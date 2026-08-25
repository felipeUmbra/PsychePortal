describe('Sessions', () => {
  const NAME = 'Sessions Test Patient';
  const MODAL = 'div[class*="inset-0"]';

  function createPatientWithSession() {
    // Create patient
    cy.visit('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.get(`${MODAL} input`).eq(0).type(NAME);
    cy.get(`${MODAL} input[type="date"]`).first().type('1988-03-03');
    cy.contains('button', /Salvar|Save/i).click();
    cy.openPatientCard(NAME);

    // Accept consent so session logging unlocks
    cy.contains(/Consentimento Informado|Informed Consent/i).click();
    cy.get('input[placeholder*="sign"], input[placeholder*="assinar"]').type(NAME);
    cy.contains('button', /Eu Aceito|I Accept/i).click();

    // Log a completed session (yesterday)
    cy.contains('button', /Registrar Sessão|Log Session/i)
      .should('not.be.disabled', { timeout: 10000 })
      .click();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDt = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}T14:00`;
    cy.get('input[type="datetime-local"]').type(localDt);
    cy.contains('button', /Salvar Registro da Sessão|Save Session/i).click();
  }

  beforeEach(() => {
    cy.loginWithGoogle();
    createPatientWithSession();
  });

  it('renders the sessions page with search and filters', () => {
    cy.visit('/#/app/sessions');
    cy.get('h1').contains(/Sessões de Terapia|Therapy Sessions/i).should('be.visible');
    cy.get('input[placeholder*="Pesquisar"], input[placeholder*="Search"]').should('be.visible');
    cy.contains('button', /Filtros|Filters/i).should('be.visible');
  });

  it('shows the logged session with patient name and status', () => {
    cy.visit('/#/app/sessions');
    cy.contains(NAME).should('be.visible');
    cy.contains(/Realizada|Completed/i).should('be.visible');
    cy.contains(/Terapia Individual|Individual Therapy/i).should('be.visible');
  });

  it('searches sessions by patient name', () => {
    cy.visit('/#/app/sessions');
    cy.contains(NAME).should('be.visible');

    cy.get('input[placeholder*="Pesquisar"], input[placeholder*="Search"]')
      .type('Nonexistent Name XYZ');
    cy.contains(NAME).should('not.exist');
  });

  it('navigates to the patient profile from a session card', () => {
    cy.visit('/#/app/sessions');
    cy.contains('a:visible, button:visible', /Ver Paciente|View Patient/i)
      .first()
      .click();
    cy.url().should('include', '/app/patients/');
  });
});