describe('Sessions and Clinical Logging', () => {
  const mockTokens = {
    driveToken: 'mock-drive-token-123',
    calendarToken: 'mock-calendar-token-456'
  };

  beforeEach(() => {
    cy.visit('/');
    cy.login(mockTokens);
  });

  it('should schedule a new session', () => {
    cy.visit('/app/patients');
    cy.contains('.card').first().click();

    cy.contains('Schedule Appointment').click();
    // NewSessionModal interactions
    cy.get('input[type="date"]').type('2026-06-01');
    cy.get('button').contains('Schedule').click();

    cy.contains('scheduled').should('be.visible');
  });

  it('should log a clinical session with notes and a file', () => {
    cy.visit('/app/patients');
    cy.contains('.card').first().click();

    cy.contains('Log Session').click();

    // SessionForm interactions
    cy.get('textarea').type('Patient showed significant improvement in mood. Discussed coping strategies.');

    // Mock file upload
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-file.pdf', { force: true });

    cy.get('button').contains('Save Record').click();

    cy.contains('completed').should('be.visible');
    cy.contains('Patient showed significant improvement').should('be.visible');
  });

  it('should allow expanding and viewing session notes', () => {
    cy.visit('/app/patients');
    cy.contains('.card').first().click();

    cy.contains('Show Notes').click();
    cy.get('.markdown-body').should('be.visible');
  });

  it('should cancel a scheduled session', () => {
    cy.visit('/app/patients');
    cy.contains('.card').first().click();

    cy.contains('Cancel').click();
    cy.contains('cancelled').should('be.visible');
  });
});
