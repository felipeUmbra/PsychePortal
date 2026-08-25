describe('Authentication Flow', () => {
  const MOCK_USER = {
    uid: 'test-user-123',
    email: 'test@example.com',
    displayName: 'Test User'
  };

  beforeEach(() => {
    // Ensure a clean, unauthenticated state before every test
    cy.visit('/');
    cy.window().then((win) => {
      win.mockAuth?.signOut();
      win.setTestTokens?.({ driveToken: null, calendarToken: null });
    });
  });

  it('should display the login page initially', () => {
    cy.visit('/');
    cy.contains('Portal Psis').should('be.visible');
    cy.contains('Acessar Portal').should('be.visible');
  });

  it('should navigate to terms page', () => {
    cy.visit('/');
    cy.contains('Termos de Serviço').click();
    cy.url().should('include', '/terms');
  });

  it('should log in successfully using the Google OAuth mock', () => {
    // Clicks the real "Sign in with Google" button. The app's MockAuth
    // simulates the Google OAuth popup and Google Drive API calls are
    // intercepted, so the full login code path runs without real network.
    cy.loginWithGoogle();

    // The mocked OAuth token should have been used to sync with Drive
    cy.wait('@driveSearch');

    // Verify we are on the dashboard
    cy.url().should('include', '/app');
    cy.contains(/Dashboard|Painel/i).should('be.visible');

    // Verify the mocked Google user session is active
    cy.get('header').contains(MOCK_USER.email).should('be.visible');
  });
});