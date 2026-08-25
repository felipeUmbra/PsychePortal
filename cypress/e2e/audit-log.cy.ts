describe('Audit Log', () => {
    beforeEach(() => {
        cy.loginWithGoogle();
        cy.visit('/#/app/audit');
        cy.get('h1').contains(/Rastro de Auditoria|Audit Trail/i).should('be.visible');
    });

    it('renders the audit trail table with filters', () => {
        // Table headers
        cy.contains(/Data\/Hora|Date\/Time/i).should('be.visible');
        cy.contains(/Ação|Action/i).should('be.visible');
        cy.contains(/Entidade|Entity/i).should('be.visible');

        // Filter controls
        cy.contains(/Todas as Entidades|All Entities/i).should('exist');
        cy.contains(/Todas as Ações|All Actions/i).should('exist');
        cy.get('input[type="date"]').should(($els) => {
            expect($els.length).to.be.greaterThan(1);
        });
        cy.contains('button', /Verificar Integridade|Verify Integrity/i).should('be.visible');
    });

    it('filters entries by entity and action', () => {
        cy.get('select').then(($selects) => {
            const entitySelect = $selects.filter((_, el) =>
                /Todas as Entidades|All Entities/i.test(el.options[0]?.text ?? '')
            );
            const actionSelect = $selects.filter((_, el) =>
                /Todas as Ações|All Actions/i.test(el.options[0]?.text ?? '')
            );
            if (entitySelect.length) {
                cy.wrap(entitySelect.first()).select(1);
                cy.wrap(entitySelect.first()).should('not.have.value', '');
            }
            if (actionSelect.length) {
                cy.wrap(actionSelect.first()).select(1);
                cy.wrap(actionSelect.first()).should('not.have.value', '');
            }
        });
        // The table (or its empty state) still renders after filtering
        cy.get('table').should('exist');
    });

    it('verifies the integrity of the log chain', () => {
        cy.contains('button', /Verificar Integridade|Verify Integrity/i).click();
        cy.contains(/Cadeia Verificada|Chain Verified/i).should('be.visible');
    });
});