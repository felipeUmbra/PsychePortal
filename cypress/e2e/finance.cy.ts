describe('Finance', () => {
    const NAME = 'Finance Test Patient';
    const MODAL = 'div[class*="inset-0"]';

    function createPatientWithSession() {
        cy.visit('/#/app/patients');
        cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
        cy.get(`${MODAL} input`).eq(0).type(NAME);
        cy.get(`${MODAL} input[type="date"]`).first().type('1987-07-07');
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
        const localDt = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}T15:00`;
        cy.get('input[type="datetime-local"]').type(localDt);
        cy.contains('button', /Salvar Registro da Sessão|Save Session/i).click();
    }

    beforeEach(() => {
        cy.loginWithGoogle();
        createPatientWithSession();
        cy.contains('a:visible', /Financeiro|Financial|Finance/i).click();
        cy.get('h1').contains(/Financeiro|Financial|Finance/i).should('be.visible');
    });

    it('renders title, stat cards and period filters', () => {
        cy.contains(/Esperado \(Sessões\)|Expected \(Sessions\)/i).should('be.visible');
        cy.contains(/Total Pago|Total Paid/i).should('be.visible');
        cy.contains(/Pagamentos Pendentes|Pending Payments/i).should('be.visible');

        cy.contains('button', /Dia|Day/i).should('be.visible');
        cy.contains('button', /Semana|Week/i).should('be.visible');
        cy.contains('button', /Mês|Month/i).should('be.visible');
        cy.contains('button', /Todos|All/i).should('be.visible');
    });

    it('lists the session transaction with pending payment status', () => {
        // Session was yesterday; switch period filter to include it
        cy.contains('button', /Todos|All/i).click();

        cy.contains(NAME).should('be.visible');
        cy.contains(/Pendente|Pending/i).should('be.visible');
    });

    it('filters transactions by patient name', () => {
        cy.contains('button', /Todos|All/i).click();
        cy.contains(NAME).should('be.visible');

        cy.get('input[placeholder*="Pesq"], input[placeholder*="Search"]')
            .type('Nonexistent Patient XYZ');
        // The transaction list shows its empty state (the patient summary
        // panel on the right is unrelated to the search)
        cy.contains(/Nenhum registro financeiro|No financial records/i)
            .should('be.visible');
    });
});