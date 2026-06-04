Cypress.Commands.add('login', (tokens: { driveToken: string, calendarToken: string }) => {
  cy.window().then((win) => {
    // 1. Trigger Firebase Auth state change
    if (win.mockAuth) {
      win.mockAuth.setUser({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: 'https://via.placeholder.com/150'
      });
    }

    // 2. Inject tokens into GoogleAuthContext and Firestore Mock
    if (win.setTestTokens) {
      win.setTestTokens({
        driveToken: tokens.driveToken,
        calendarToken: tokens.calendarToken
      });
    }
  });

  // Give the app a moment to react to the auth state change and redirect
  cy.url().should('include', '/app');
});
