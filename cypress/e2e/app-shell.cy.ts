describe('App Shell', () => {
    beforeEach(() => {
        cy.loginWithGoogle();
        cy.visit('/#/app');
        cy.get('h1').should('be.visible');
    });

    it('renders the sidebar with all navigation items', () => {
        cy.contains('a:visible', /Painel|Dashboard/i).should('be.visible');
        cy.contains('a:visible', /Pacientes|Patients/i).should('be.visible');
        cy.contains('a:visible', /Agenda|Calendar/i).should('be.visible');
        cy.contains('a:visible', /Sessões|Sessions/i).should('be.visible');
        cy.contains('a:visible', /Financeiro|Finance/i).should('be.visible');
        cy.contains('a:visible', /Configurações|Settings/i).should('be.visible');
        cy.contains('a:visible', /Conformidade|Compliance/i).should('be.visible');
    });

    it('shows the workspace header with user identity', () => {
        cy.contains(/Portal Psis/i).should('be.visible');
        cy.contains(/test.user|@example/i).should('exist');
    });

    it('navigates between pages via the sidebar', () => {
        cy.contains('a:visible', /Pacientes|Patients/i).click();
        cy.url().should('include', '/app/patients');
        cy.contains('a:visible', /Financeiro|Finance/i).click();
        cy.url().should('include', '/app/finance');
        cy.contains('a:visible', /Painel|Dashboard/i).click();
        cy.url().should('include', '/app');
    });

    it('offers a language toggle', () => {
        cy.contains(/English|Português/i).first().should('be.visible');
    });

    it('logs out from the sidebar and returns to the login page', () => {
        cy.contains('button', /^Sair$|Logout|Log out/i).click({ force: true });
        cy.url().should('include', '/login');
        cy.contains(/Entrar com o Google|Sign in with Google/i).should('be.visible');
    });
});