describe('Authentication Flow', () => {
  const mockTokens = {
    driveToken: 'mock-drive-token-123',
    calendarToken: 'mock-calendar-token-456'
  };

  it('should display the login page initially', () => {
    cy.visit('/');
    cy.contains('Portal Psis').should('be.visible');
    cy.contains('sign in').should('be.visible');
  });

  it('should navigate to terms page', () => {
    cy.visit('/');
    cy.contains('Terms').click();
    cy.url().should('include', '/terms');
  });

  it('should log in successfully using the mock backdoor', () => {
    cy.visit('/');
    cy.login(mockTokens);

    // Verify we are on the dashboard
    cy.url().should('include', '/app');
    cy.contains('Dashboard').should('be.visible');
  });
});
