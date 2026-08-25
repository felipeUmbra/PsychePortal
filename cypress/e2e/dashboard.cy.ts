describe('Dashboard', () => {
    beforeEach(() => {
        cy.loginWithGoogle();
    });

    it('renders greeting, title and stat cards', () => {
        cy.get('h1').contains(/Visão Geral do Painel|Dashboard/i).should('be.visible');
        cy.contains(/Bem-vindo|Welcome/i).should('be.visible');

        // 4 stat cards
        cy.contains(/Total de Pacientes|Total Patients/i).should('be.visible');
        cy.contains(/Total de Sessões|Total Sessions/i).should('be.visible');
        cy.contains(/Próximas Consultas|Upcoming Appointments/i).should('be.visible');
        cy.contains(/Crescimento|Growth/i).should('be.visible');
    });

    it('header actions navigate to the calendar', () => {
        cy.contains('button, a', /Ver Agenda|View Calendar/i).click();
        cy.url().should('include', '/app/calendar');
    });

    it('quick action Add Patient opens the patients page with form', () => {
        cy.contains('a:visible, button:visible', /Add Paciente|Add Patient/i)
            .first()
            .click();
        cy.url().should('include', '/app/patients');
    });

    it("today's schedule section renders (list or empty state)", () => {
        cy.contains(/Agenda de Hoje|Today's Schedule|Schedule/i).should('be.visible');
    });

    it('recent sessions section renders', () => {
        cy.contains(/Sessões Recentes|Recent Sessions/i).should('be.visible');
    });
});