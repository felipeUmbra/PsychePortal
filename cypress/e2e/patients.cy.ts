describe('Patients Directory', () => {
  const PATIENT = {
    name: 'John Doe',
    email: 'john.doe@test.com',
    phone: '11999998888'
  };

  beforeEach(() => {
    cy.loginWithGoogle();
    cy.visit('/#/app/patients');
    cy.contains(/Diretório de Pacientes|Patients/i).should('be.visible');
  });

  function openAddForm() {
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.contains(/Adicionar Novo Paciente|Add New Patient/i).should('be.visible');
  }

  function fillRequiredFields(name: string) {
    // Inputs have no name attributes; order inside the modal:
    // name, CPF, email, phone, birth date...
    const modal = 'div.fixed.inset-0.z-50';
    cy.get(`${modal} input`).eq(0).clear().type(name);
    cy.get(`${modal} input`).eq(2).clear().type(PATIENT.email);
    cy.get(`${modal} input`).eq(3).clear().type(PATIENT.phone);
    cy.get(`${modal} input[type="date"]`).first().type('1990-01-01');
  }

  it('creates a new patient', () => {
    openAddForm();
    fillRequiredFields(PATIENT.name);
    cy.contains('button', /Salvar|Save/i).click();

    cy.contains('.card', PATIENT.name).should('be.visible');
    cy.contains('.card', PATIENT.email).should('be.visible');
  });

  it('searches patients by name', () => {
    openAddForm();
    fillRequiredFields(PATIENT.name);
    cy.contains('button', /Salvar|Save/i).click();
    cy.contains('.card', PATIENT.name).should('be.visible');

    cy.get('input[placeholder*="Pesquisar"], input[placeholder*="Search"]')
      .type(PATIENT.name);
    cy.contains('.card', PATIENT.name).should('be.visible');

    cy.get('input[placeholder*="Pesquisar"], input[placeholder*="Search"]')
      .clear()
      .type('Nonexistent Patient XYZ');
    cy.contains('.card', PATIENT.name).should('not.exist');
  });

  it('shows financial plan filter options', () => {
    cy.contains('button', /Filtros|Filters/i).click();
    cy.contains(/Plano Financeiro|Financial Plan/i).should('be.visible');
    // Close dropdown
    cy.get('body').click('topLeft');
  });

  it('edits an existing patient', () => {
    openAddForm();
    fillRequiredFields(PATIENT.name);
    cy.contains('button', /Salvar|Save/i).click();
    cy.contains('.card', PATIENT.name).should('be.visible');

    cy.contains('.card', PATIENT.name)
      .find('button')
      .last()
      .click();
    cy.contains(/Editar|Edit/i).click();
    cy.contains(/Editar Paciente|Edit Patient/i).should('be.visible');

    cy.get('div.fixed.inset-0.z-50 input').eq(0).clear().type('John Doe Updated');
    cy.contains('button', /Salvar|Save/i).click();
    cy.contains('.card', 'John Doe Updated').should('be.visible');
  });

  it('deletes a patient after confirmation', () => {
    openAddForm();
    fillRequiredFields(PATIENT.name);
    cy.contains('button', /Salvar|Save/i).click();
    cy.contains('.card', PATIENT.name).should('be.visible');

    cy.contains('.card', PATIENT.name)
      .find('button')
      .last()
      .click();
    cy.contains(/Excluir|Delete/i).click();

    // window.confirm is auto-accepted by Cypress
    cy.contains('.card', PATIENT.name).should('not.exist');
  });
});