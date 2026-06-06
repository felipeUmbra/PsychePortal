describe('User Login Flow', () => {
    const mockTokens = {
        driveToken: 'mock-drive-token-login-123',
        calendarToken: 'mock-calendar-token-login-456'
    };

    const mockUser = {
        uid: 'login-flow-test-789',
        email: 'login.flow@test.com',
        displayName: 'Login Flow Test User',
        photoURL: 'https://via.placeholder.com/150'
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

            // System status badge
            cy.contains(/System Operational|Sistema Operacional/i)
                .should('be.visible');
        });

        it('should navigate to the terms page from the login footer', () => {
            cy.contains(/Terms|Termos/i).first().click();
            cy.url().should('include', '/terms');
            cy.contains(/Terms of Service|Termos de Serviço/i).should('be.visible');
            cy.contains(/Privacy Policy|Política de Privacidade/i).should('be.visible');
        });

        it('should show an error when Google sign-in is triggered in test mode', () => {
            // In Cypress the real auth module is swapped for MockAuth,
            // so clicking the button will cause signInWithPopup to fail.
            cy.get('button')
                .contains(/Sign in with Google|Entrar com o Google/i)
                .click();

            // The catch block in Login.tsx should surface a fallback error message.
            cy.contains(/An error occurred|Falha no login/i, { timeout: 10000 })
                .should('be.visible');
        });
    });

    context('Authentication & Route Guards', () => {
        it('should redirect unauthenticated users away from protected routes', () => {
            cy.visit('/app/patients');
            // Layout's auth guard sends us back to login
            cy.contains('Portal Psis').should('be.visible');
            cy.get('button')
                .contains(/Sign in with Google|Entrar com o Google/i)
                .should('be.visible');
        });

        it('should login via mock auth and render the dashboard', () => {
            // Simulate a successful Google sign-in by injecting the mock user
            // into the Firebase-style MockAuth exposed on the window.
            cy.window().then((win) => {
                if (win.mockAuth) {
                    win.mockAuth.setUser(mockUser);
                }
                if (win.setTestTokens) {
                    win.setTestTokens(mockTokens);
                }
            });

            // The Login page itself does not auto-redirect on auth-state change,
            // so we explicitly navigate to the app shell.
            cy.visit('/app');
            cy.url().should('include', '/app');

            // Dashboard assertions
            cy.contains(/Dashboard|Painel/i).should('be.visible');
            cy.contains(mockUser.displayName).should('be.visible');
        });

        it('should allow navigation to internal pages after logging in', () => {
            cy.window().then((win) => {
                if (win.mockAuth) win.mockAuth.setUser(mockUser);
                if (win.setTestTokens) win.setTestTokens(mockTokens);
            });
            cy.visit('/app');

            // Navigate via sidebar
            cy.contains(/Patients|Pacientes/i).first().click();
            cy.url().should('include', '/app/patients');
            cy.contains(/Patient Directory|Diretório de Pacientes/i).should('be.visible');

            // Navigate to Finance
            cy.contains(/Finance|Financeiro/i).first().click();
            cy.url().should('include', '/app/finance');
            cy.contains(/Financial|Financeiro/i).should('be.visible');
        });
    });

    context('Session Management (Logout)', () => {
        beforeEach(() => {
            // Establish a logged-in session before each logout test
            cy.window().then((win) => {
                if (win.mockAuth) win.mockAuth.setUser(mockUser);
                if (win.setTestTokens) win.setTestTokens(mockTokens);
            });
            cy.visit('/app');
        });

        it('should display the logged-in user in the app header', () => {
            cy.get('header').contains(mockUser.displayName).should('be.visible');
        });

        it('should log out and return to the login page', () => {
            // Open the user menu dropdown in the header
            cy.get('header')
                .contains(mockUser.displayName)
                .click();

            // Click logout
            cy.contains(/Logout|Sair/i).click();

            // Should land back on the login page
            cy.contains('Portal Psis').should('be.visible');
            cy.get('button')
                .contains(/Sign in with Google|Entrar com o Google/i)
                .should('be.visible');
        });
    });
});
