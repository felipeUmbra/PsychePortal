describe('Calendar', () => {
    const NAME = 'Calendar Test Patient';
    const MODAL = 'div[class*="inset-0"]';

    function createPatient() {
        cy.visit('/#/app/patients');
        cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
        cy.get(`${MODAL} input`).eq(0).type(NAME);
        cy.get(`${MODAL} input[type="date"]`).first().type('1990-02-02');
        cy.contains('button', /Salvar|Save/i).click();
        cy.contains('.card', NAME).should('be.visible');
    }

    function scheduleTomorrow(hour: string) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const iso = tomorrow.toISOString().slice(0, 10);

        cy.visit('/#/app/calendar/daily');
        cy.contains('button', /Nova Consulta|New Appointment/i).click();
        cy.contains(/Agendar Consulta|Schedule Appointment/i).should('be.visible');

        cy.get(`${MODAL} select`).eq(0).select(NAME);
        cy.get(`${MODAL} input[type="date"]`).type(iso);
        cy.get(`${MODAL} select`).eq(1).select(hour);
        cy.get(MODAL)
            .contains('button', /Confirmar Agendamento|Confirm Schedule|Agendar|Schedule/i)
            .click();
        cy.get(MODAL).should('not.exist');
    }

    beforeEach(() => {
        cy.loginWithGoogle();
        createPatient();
    });

    it('renders the full calendar with toolbar controls', () => {
        cy.visit('/#/app/calendar');
        cy.get('h1').contains(/Calendário Completo|Entire Calendar|Full Calendar/i).should('be.visible');
        // react-big-calendar built-in toolbar (pt labels)
        cy.contains('button', /Hoje|Today/i).should('be.visible');
        cy.contains('button', /Mês|Month/i).should('be.visible');
        cy.contains('button', /Semana|Week/i).should('be.visible');
        cy.contains('button', /Dia|Day/i).should('be.visible');
    });

    it('renders the daily view with hour grid and new appointment button', () => {
        cy.visit('/#/app/calendar/daily');
        cy.get('h1').contains(/Sessões por Dia|Sessions by Day/i).should('be.visible');
        cy.contains('button', /Nova Consulta|New Appointment/i).should('be.visible');
        cy.contains(/08:00|8:00/).should('be.visible');
        cy.contains('18:00').should('be.visible');
    });

    it('schedules an appointment from the daily view', () => {
        scheduleTomorrow('10:00');

        // The event shows up on the full calendar month grid
        cy.visit('/#/app/calendar');
        cy.contains(NAME).should('be.visible');
        cy.contains(/Agendad[ao]|Scheduled/i).should('be.visible');
    });

    it('navigates to the patient when clicking a calendar event', () => {
        scheduleTomorrow('11:00');

        cy.visit('/#/app/calendar');
        cy.contains(NAME).click();
        cy.url().should('include', '/app/patients/');
        cy.get('h1').contains(NAME).should('be.visible');
    });
});