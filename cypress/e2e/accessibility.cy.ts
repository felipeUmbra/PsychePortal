describe('Accessibility', () => {
  const MODAL = 'div[class*="inset-0"]';
  const toolbarLabels = [
    'Bold',
    'Italic',
    'Underline',
    'Heading',
    'Bullet List',
    'Numbered List',
    'Add Link',
    'Clear Formatting',
  ];

  function openSessionEditor() {
    const patientName = 'Accessibility Test Patient';

    cy.loginWithGoogle();
    cy.visit('/#/app/settings');
    cy.get('textarea[placeholder*="consentimento"], textarea[placeholder*="consent"]')
      .clear()
      .type('Consentimento padrão para testes de acessibilidade.');
    cy.contains('button', /Salvar Alterações|Save Changes/i)
      .scrollIntoView()
      .click({ force: true });

    cy.visit('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.get(`${MODAL} input`).eq(0).type(patientName);
    cy.get(`${MODAL} input[type="date"]`).first().type('1988-03-03');
    cy.contains('button', /Salvar|Save/i).click();
    cy.openPatientCard(patientName);

    cy.contains(/Consentimento Informado|Informed Consent/i).click();
    cy.get('input[placeholder*="sign"], input[placeholder*="assinar"]').type(patientName);
    cy.contains('button', /Eu Aceito|I Accept/i).click();
    cy.contains('button', /Registrar Sessão|Log Session/i)
      .should('not.be.disabled')
      .click();
    cy.get('[contenteditable="true"]').should('be.visible');
  }

  it('gives the login action an accessible name and keyboard focus', () => {
    cy.visit('/#/login');

    cy.contains('button', /Sign in with Google|Entrar com o Google/i)
      .should(($button) => {
        expect($button.attr('aria-label')).to.match(/Google/i);
      });
    cy.contains('button', /Sign in with Google|Entrar com o Google/i)
      .focus()
      .should('have.focus')
      .and('have.class', 'focus-visible:ring-2');

    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.contains('a', /Terms and Privacy Policy|Termos e Política de Privacidade/i)
      .should('have.focus');
  });

  it('announces sign-in failures through an alert', () => {
    cy.visit('/#/login');
    cy.window().then((win) => {
      cy.stub((win as any).mockAuth, 'signInWithPopup')
        .rejects({ code: 'auth/network-request-failed' });
    });

    cy.contains('button', /Sign in with Google|Entrar com o Google/i).click();
    cy.get('[role="alert"]')
      .should('be.visible')
      .should(($alert) => {
        expect($alert.text()).to.match(/Network error|Erro de rede/i);
      });
  });

  it('exposes app landmarks and supports keyboard operation of the account menu', () => {
    cy.loginWithGoogle();

    cy.get('header').should('be.visible');
    cy.get('main').should('have.length', 1);
    cy.get('nav').should('exist');

    cy.get('header button[aria-expanded]').should(($button) => {
      expect($button.attr('aria-label')).to.be.not.empty;
      expect($button.attr('aria-expanded')).to.equal('false');
    });
    cy.get('header button[aria-expanded]').focus();
    cy.focused().should('have.attr', 'aria-expanded', 'false');
    cy.press(Cypress.Keyboard.Keys.SPACE);

    cy.get('header button[aria-expanded]').should('have.attr', 'aria-expanded', 'true');
    cy.get('header').contains('a', /Configurações|Settings/i).should('be.visible');
  });

  it('keeps the mobile navigation operable with its labeled menu button', () => {
    cy.viewport(390, 844);
    cy.loginWithGoogle();

    cy.get('button[aria-label="Toggle Menu"]')
      .should('be.visible')
      .focus()
      .should('have.focus');
    cy.press(Cypress.Keyboard.Keys.SPACE);

    cy.get('aside').should('have.class', 'translate-x-0');
    cy.get('nav').contains('a', /Pacientes|Patients/i).should('be.visible').click();
    cy.url().should('include', '/app/patients');
  });

  it('names every rich-text toolbar button and exposes keyboard focus', () => {
    openSessionEditor();

    cy.get('[contenteditable="true"]')
      .parent()
      .find('button[aria-label]')
      .should('have.length', toolbarLabels.length);

    toolbarLabels.forEach((label) => {
      cy.get('[contenteditable="true"]')
        .parent()
        .find(`button[aria-label="${label}"]`)
        .should('be.visible');
    });

    cy.get('button[aria-label="Bold"]')
      .focus()
      .should('have.focus')
      .and('have.class', 'focus-visible:ring-2');
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.get('button[aria-label="Italic"]').should('have.focus');
  });
});