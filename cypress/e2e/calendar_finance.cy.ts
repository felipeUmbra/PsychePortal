describe('Calendar and Finance', () => {
  const mockTokens = {
    driveToken: 'mock-drive-token-123',
    calendarToken: 'mock-calendar-token-456'
  };

  beforeEach(() => {
    cy.visit('/');
    cy.login(mockTokens);
  });

  it('should display the dashboard and its stats', () => {
    cy.visit('/app');
    cy.contains('Dashboard').should('be.visible');
    cy.get('.card').should('have.length.at.least', 4);
  });

  it('should navigate to the calendar and daily view', () => {
    cy.visit('/app/calendar');
    cy.url().should('include', '/app/calendar');

    cy.get('button').contains('Daily View').click(); // Assuming this button exists
    cy.url().should('include', '/app/calendar/daily');
  });

  it('should display the finance page', () => {
    cy.visit('/app/finance');
    cy.url().should('include', '/app/finance');
    cy.get('h1').should('contain', 'Finance');
  });
});
