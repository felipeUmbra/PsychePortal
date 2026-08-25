describe('User Login Flow', () => {
    const MOCK_USER = {
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User'
    };

    beforeEach(() => {
        // Ensure a clean, unauthenticated state before every test
        cy.visit('/');
        cy.window().then((win) => {
            if (win.mockAuth) {
                win.mockAuth.signOut();
            }
            if (win.setTestTokens) {
                win.setTestTokens({ driveToken: null, calendarToken: null });
            }
        });
    });

    context('Login Page UI & Navigation', () => {
        it('should render all login page elements', () => {
            cy.visit('/#/login');

            // App branding
            cy.contains('Portal Psis').should('be.visible');

            // Google sign-in button is visible and not disabled
            cy.get('button')
                .contains(/Sign in with Google|Entrar com o Google/i)
                .should('be.visible')
                .and('not.be.disabled');

            // Terms link exists in footer
            cy.contains(/Terms and Privacy Policy|Termos e Política de Privacidade/i)
                .should('exist');
        });

        it('should navigate to the terms page from the login footer', () => {
            cy.visit('/#/login');
            cy.contains(/Terms|Termos/i).first().click();
            cy.url().should('include', '/terms');
            cy.contains(/Terms of Service|Termos de Serviço/i).should('be.visible');
            cy.contains(/Privacy Policy|Política de Privacidade/i).should('be.visible');
        });

        it('should complete Google sign-in via the OAuth mock', () => {
            // In Cypress the real auth module is swapped for MockAuth, which
            // simulates a successful Google OAuth popup on button click.
            cy.loginWithGoogle();

            // The mocked OAuth success should land on the app shell.
            cy.contains(/Dashboard|Painel/i).should('be.visible');
        });
    });

    context('Authentication & Route Guards', () => {
        it('should redirect unauthenticated users away from protected routes', () => {
            cy.visit('/#/app/patients');
            // Layout's auth guard sends us back to login
            cy.url().should('include', '/login');
            cy.get('button')
                .contains(/Sign in with Google|Entrar com o Google/i)
                .should('be.visible');
        });

        it('should login via the Google OAuth mock and render the dashboard', () => {
            cy.loginWithGoogle();

            // Dashboard assertions
            cy.contains(/Dashboard|Painel/i).should('be.visible');
            cy.get('header').contains(MOCK_USER.displayName).should('be.visible');
        });

        it('should allow navigation to internal pages after logging in', () => {
            cy.loginWithGoogle();

            // Navigate via sidebar
            cy.contains(/Patients|Pacientes/i).first().click();
            cy.url().should('include', '/app/patients');

            // Navigate to Finance
            cy.contains(/Financial|Finance|Financeiro/i).first().click();
            cy.url().should('include', '/app/finance');
        });
    });

    context('Session Management (Logout)', () => {
        beforeEach(() => {
            // Establish a logged-in session before each logout test
            cy.loginWithGoogle();
        });

        it('should display the logged-in user in the app header', () => {
            cy.get('header').contains(MOCK_USER.displayName).should('be.visible');
        });

        it('should log out and return to the login page', () => {
            // Open the user menu dropdown in the header
            cy.get('header')
                .contains(MOCK_USER.displayName)
                .click();

            // Click logout (scoped to the header dropdown)
            cy.get('header')
                .contains(/Logout|Sair/i)
                .click();

            // Should land back on the login page
            cy.contains('Portal Psis').should('be.visible');
            cy.get('button')
                .contains(/Sign in with Google|Entrar com o Google/i)
                .should('be.visible');
        });
    });
});