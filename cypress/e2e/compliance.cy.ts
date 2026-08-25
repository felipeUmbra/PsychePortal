describe('Compliance', () => {
    beforeEach(() => {
        cy.loginWithGoogle();
        cy.visit('/#/app/compliance');
        cy.get('h1').contains(/Conformidade|Compliance/i).should('be.visible');
    });

    it('renders the compliance status panel with all LGPD items', () => {
        cy.contains(/Status de Conformidade|Compliance Status/i).should('be.visible');
        cy.contains(/Criptografia em Repouso|Encryption at Rest/i).should('be.visible');
        cy.contains(/Rastro de Auditoria|Audit Trail/i).should('be.visible');
        cy.contains(/Backup no Google Drive|Google Drive Backup/i).should('be.visible');
        cy.contains(/Consentimento do Paciente|Patient Consent/i).should('be.visible');
        cy.contains(/Política de Retenção|Retention Policy/i).should('be.visible');
        cy.contains(/Cabeçalhos de Segurança|Security Headers/i).should('be.visible');
    });

    it('shows the conformity counter', () => {
        cy.contains(/\/6 Conforme|\/6 Compliant/i).should('be.visible');
    });

    it('shows conformity badges for each item', () => {
        cy.contains(/Conforme|Compliant/i).should('be.visible');
    });

    it('offers compliance report and audit log exports', () => {
        cy.contains('button', /Exportar Relatório de Conformidade|Export Compliance Report/i)
            .should('be.visible');
        cy.contains('button', /Exportar Log de Auditoria|Export Audit Log/i)
            .should('be.visible');
    });
});