describe('Patient Detail', () => {
    const NAME = 'Detail Test Patient';
    // Matches any full-screen modal overlay regardless of z-index utility
    const MODAL = 'div[class*="inset-0"]';

    function configureConsentText() {
        // Log Session only renders once a default consent text exists
        cy.visit('/#/app/settings');
        cy.get('textarea[placeholder*="consentimento"], textarea[placeholder*="consent"]')
            .type('Consentimento padrão para testes E2E.');
        cy.contains('button', /Salvar Alterações|Save Changes/i)
            .scrollIntoView()
            .click({ force: true });
    }

    function createAndOpenPatient() {
        configureConsentText();
        cy.visit('/#/app/patients');
        cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
        cy.get(`${MODAL} input`).eq(0).type(NAME);
        cy.get(`${MODAL} input`).eq(2).type('detail@test.com');
        cy.get(`${MODAL} input[type="date"]`).first().type('1985-05-05');
        cy.contains('button', /Salvar|Save/i).click();
        cy.url().should('include', '/app/patients');
        cy.openPatientCard(NAME);
    }

    beforeEach(() => {
        cy.loginWithGoogle();
        createAndOpenPatient();
    });

    it('renders header with patient name and action buttons', () => {
        cy.get('h1').contains(NAME).should('be.visible');
        cy.contains('button', /Editar Perfil|Edit Profile/i).should('be.visible');
        cy.contains('button', /Agendar uma Sessão|Schedule Appointment/i).should('be.visible');
        cy.contains(/Histórico de Sessões|Session History/i).should('be.visible');
        cy.contains(/Consentimento Informado|Informed Consent/i).should('be.visible');
    });

    it('locks Log Session until consent is given', () => {
        cy.contains('button', /Registrar Sessão|Log Session/i)
            .should('be.disabled', { timeout: 10000 });

        // Accept consent
        cy.contains(/Consentimento Informado|Informed Consent/i).click();
        cy.get('input[placeholder*="sign"], input[placeholder*="assinar"]')
            .type(NAME);
        cy.contains('button', /Eu Aceito|I Accept/i).click();

        // App switches back to sessions tab and unlocks logging
        cy.contains('button', /Registrar Sessão|Log Session/i)
            .should('not.be.disabled', { timeout: 10000 });
    });

    it('schedules an appointment from the detail page', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const iso = tomorrow.toISOString().slice(0, 10);

        cy.contains('button', /Agendar uma Sessão|Schedule Appointment/i).click();
        cy.contains(/Agendar Consulta|Schedule Appointment/i).should('be.visible');

        cy.get(`${MODAL} input[type="date"]`).type(iso);
        // Time select is the second select (first is the preselected patient)
        cy.get(`${MODAL} select`).eq(1).select('10:00');
        cy.get(MODAL)
            .contains('button', /Confirmar Agendamento|Confirm Schedule|Agendar|Schedule/i)
            .click();

        // Modal should close on success
        cy.get(MODAL).should('not.exist');

        // Scheduled session appears with a status badge
        cy.contains(/Agendad[ao]|Scheduled/i).should('be.visible');
    });

    it('deletes all patient data after typed confirmation', () => {
        cy.contains('button', /Excluir Todos os Dados|Delete All Patient Data/i).click();

        // Confirmation requires typing the patient name
        cy.get(`${MODAL} input`).type(NAME);
        cy.get(MODAL).contains('button', /Excluir|Delete|Confirmar|Confirm/i).click();

        cy.url().should('include', '/app/patients');
        cy.contains('.card', NAME).should('not.exist');
    });
});