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

    it('exports patient data as a CSV file', () => {
        // Create a patient first so the export has data
        const exportName = 'Export CSV Patient';
        cy.visit('/#/app/patients');
        cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
        cy.get('div[class*="inset-0"] input').eq(0).type(exportName);
        cy.get('div[class*="inset-0"] input[type="date"]').first().type('1985-05-05');
        cy.contains('button', /Salvar|Save/i).click();
        cy.contains('.card', exportName).should('be.visible');

        // Go to settings and download the CSV via the anchor download attribute.
        // The export handler sets link.download then calls link.click(), so we
        // intercept HTMLElement.click to capture the filename.
        cy.visit('/#/app/settings');
        cy.get('h1').contains(/Configurações da Conta|Account Settings/i).should('be.visible');

        let downloadName = '';
        cy.window().then((win) => {
            cy.stub(win.HTMLAnchorElement.prototype, 'click').callsFake(function (this: HTMLAnchorElement) {
                downloadName = this.getAttribute('download') || '';
            });
        });

        cy.contains('button', /Exportar para CSV|Export to CSV/i)
            .scrollIntoView()
            .should('be.visible')
            .click();

        // Filename convention: export_<option>_<timestamp>.csv
        cy.wrap(null, { timeout: 10000 }).should(() => {
            expect(downloadName, 'CSV download filename').to.match(/^export_.+\.csv$/);
        });
    });
});