// Intercepts all Google Drive API endpoints used by the Firestore mock sync
// layer so no real network calls happen during tests.
Cypress.Commands.add('mockDriveApi', () => {
  cy.intercept('GET', '**/drive/v3/files**', { files: [] }).as('driveSearch');
  cy.intercept('POST', '**/upload/drive/v3/files**', { id: 'mock-drive-file' }).as('driveCreate');
  cy.intercept('PATCH', '**/upload/drive/v3/files**', { id: 'mock-drive-file' }).as('driveUpdate');
});

// Intercepts Google Calendar API endpoints (e.g. event deletion when
// cancelling an appointment) so calendar integrations stay offline.
Cypress.Commands.add('mockCalendarApi', () => {
  cy.intercept(/googleapis\.com\/calendar\/v3\/.*events/, { statusCode: 200, body: { id: 'mock-calendar-event' } }).as('calendarApi');
});

// Opens a patient's detail page from the patients directory card link.
// The detail page can intermittently render blank while the Drive sync
// layer settles, so the navigation is retried once before failing.
Cypress.Commands.add('openPatientCard', (name: string) => {
  cy.contains('.card', name).find('a').first().click();
  cy.wait(2000);
  cy.get('body').then(($body) => {
    if (!$body.find('h1').text().includes(name)) {
      cy.visit('/#/app/patients');
      cy.contains('.card', name).find('a').first().click();
    }
  });
  cy.contains('h1', name, { timeout: 15000 }).should('be.visible');
});

// Mocks the Google OAuth login by clicking the real "Sign in with Google"
// button. The app's MockAuth simulates the OAuth popup, and Google Drive API
// calls made by the sync layer are intercepted so no real network happens.
Cypress.Commands.add('loginWithGoogle', () => {
  cy.mockDriveApi();
  cy.mockCalendarApi();

  cy.visit('/#/login');

  // Click the actual Google sign-in button (PT or EN locale)
  cy.contains('button', /entrar com o google|sign in with google/i).click();

  // The app should react to the mocked OAuth success and navigate to the app
  cy.url().should('include', '/app');
});