describe('Settings', () => {
    const CRP = '06/123456';
    const CONSENT = 'Consentimento padrão para testes E2E.';

    beforeEach(() => {
        cy.loginWithGoogle();
        cy.visit('/#/app/settings');
        cy.get('h1').contains(/Configurações da Conta|Account Settings/i).should('be.visible');
    });

    it('renders profile fields with disabled email', () => {
        cy.contains(/Nome Completo|Full Name/i).should('be.visible');
        cy.get('input[type="email"]').should('be.disabled');
        cy.get('input[placeholder*="06/"]').should('be.visible');
        cy.contains('button', /Salvar Alterações|Save Changes/i).should('be.visible');
    });

    it('saves the CRP registration and consent text', () => {
        cy.get('input[placeholder*="06/"]').clear().type(CRP);
        cy.get('textarea[placeholder*="consentimento"], textarea[placeholder*="consent"]')
            .clear()
            .type(CONSENT);
        cy.contains('button', /Salvar Alterações|Save Changes/i)
            .scrollIntoView()
            .click({ force: true });

        // Values persist after leaving and returning to the page
        cy.contains('a:visible', /Pacientes|Patients/i).click();
        cy.contains('a:visible', /Configurações|Settings/i).click();
        cy.get('input[placeholder*="06/"]').should('have.value', CRP);
        cy.get('textarea[placeholder*="consentimento"], textarea[placeholder*="consent"]')
            .should('have.value', CONSENT);
    });

    it('changes the inactivity lock preference', () => {
        cy.contains(/Bloqueio automático|Auto-lock/i).should('be.visible');
        cy.get('select').then(($selects) => {
            const lockSelect = $selects.filter((_, el) =>
                /Nunca|Never/.test(el.options[el.selectedIndex]?.text ?? '')
            );
            if (lockSelect.length) {
                cy.wrap(lockSelect.first()).select('15');
            }
        });
    });
});