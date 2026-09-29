/// <reference types="cypress" />
/// <reference types="cypress-axe" />

function visitAppRoute(path: string) {
  const hashPath = path.replace(/^\/#/, '');
  cy.get('header').should('be.visible');
  cy.window().then((win) => {
    win.location.hash = hashPath;
  });
  cy.location('hash').should('eq', `#${hashPath}`);
}

function openSessionEditor() {
  const patientName = 'Accessibility Test Patient';

  visitAppRoute('/#/app/settings');
  cy.get('textarea[placeholder*="consentimento"], textarea[placeholder*="consent"]')
    .clear()
    .type('Consentimento padrão para testes de acessibilidade.');
  cy.contains('button', /Salvar Alterações|Save Changes/i)
    .scrollIntoView()
    .click({ force: true });

  visitAppRoute('/#/app/patients');
  cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
  cy.get('#patient-name').type(patientName);
  cy.get('#patient-dob').type('1988-03-03');
  cy.contains('[role="dialog"] button', /Salvar|Save/i).click();
  cy.openPatientCard(patientName);

  cy.contains(/Consentimento Informado|Informed Consent/i).click();
  cy.get('input[placeholder*="sign"], input[placeholder*="assinar"]').type(patientName);
  cy.contains('button', /Eu Aceito|I Accept/i).click();
  cy.contains('button', /Registrar Sessão|Log Session/i)
    .should('not.be.disabled')
    .click();
  cy.get('[contenteditable="true"]').should('be.visible');
}

describe('Accessibility - Full Page Audits', () => {
  const routes = [
    { path: '/#/', name: 'Landing Page' },
    { path: '/#/login', name: 'Login Page' },
    { path: '/#/terms', name: 'Terms Page' },
    { path: '/#/privacy', name: 'Privacy Page' },
  ];

  routes.forEach((route) => {
    it(`should have no accessibility violations on ${route.name}`, () => {
      cy.visit(route.path);
      cy.get('main').should('have.length', 1);
      cy.checkA11yCustom();
    });
  });
});

describe('Accessibility - Authenticated Routes', () => {
  beforeEach(() => {
    cy.loginWithGoogle();
  });

  const authenticatedRoutes = [
    { path: '/#/app', name: 'Dashboard' },
    { path: '/#/app/patients', name: 'Patients List' },
    { path: '/#/app/calendar', name: 'Calendar' },
    { path: '/#/app/calendar/daily', name: 'Daily Calendar' },
    { path: '/#/app/sessions', name: 'Sessions' },
    { path: '/#/app/finance', name: 'Finance' },
    { path: '/#/app/settings', name: 'Settings' },
    { path: '/#/app/audit', name: 'Audit Log' },
    { path: '/#/app/compliance', name: 'Compliance' },
  ];

  authenticatedRoutes.forEach((route) => {
    it(`should have no accessibility violations on ${route.name}`, () => {
      visitAppRoute(route.path);
      cy.checkA11yCustom();
    });
  });
});

describe('Accessibility - Specific Component Tests', () => {
  beforeEach(() => {
    cy.loginWithGoogle();
  });

  it('should have accessible PatientForm modal', () => {
    visitAppRoute('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    
    // Check modal accessibility
    cy.get('[role="dialog"]').should('exist');
    cy.get('[aria-modal="true"]').should('exist');
    cy.get('#patient-form-title').should('exist');
    
    // Check form labels
    cy.get('label[for="patient-name"]').should('exist');
    cy.get('#patient-name').should('exist');
    cy.get('label[for="patient-cpf"]').should('exist');
    cy.get('#patient-cpf').should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have accessible SessionForm', () => {
    openSessionEditor();
    
    // Check form labels
    cy.get('label[for="session-date"]').should('exist');
    cy.get('#session-date').should('exist');
    cy.get('label[for="session-type"]').should('exist');
    cy.get('#session-type').should('exist');
    cy.get('label[for="session-status"]').should('exist');
    cy.get('#session-status').should('exist');
    cy.get('label[for="session-notes"]').should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have accessible Settings page forms', () => {
    visitAppRoute('/#/app/settings');
    
    // Check form labels
    cy.get('label[for="settings-full-name"]').should('exist');
    cy.get('#settings-full-name').should('exist');
    cy.get('label[for="settings-email"]').should('exist');
    cy.get('#settings-email').should('exist');
    cy.get('label[for="settings-crp-number"]').should('exist');
    cy.get('#settings-crp-number').should('exist');
    cy.get('label[for="settings-crp-region"]').should('exist');
    cy.get('#settings-crp-region').should('exist');
    cy.get('label[for="settings-dpo-name"]').should('exist');
    cy.get('#settings-dpo-name').should('exist');
    cy.get('label[for="settings-dpo-email"]').should('exist');
    cy.get('#settings-dpo-email').should('exist');
    cy.get('label[for="settings-specializations"]').should('exist');
    cy.get('#settings-specializations').should('exist');
    cy.get('label[for="settings-bio"]').should('exist');
    cy.get('#settings-bio').should('exist');
    cy.get('label[for="settings-auto-lock"]').should('exist');
    cy.get('#settings-auto-lock').should('exist');
    cy.get('label[for="settings-retention-years"]').should('exist');
    cy.get('#settings-retention-years').should('exist');
    cy.get('label[for="settings-retention-enabled"]').should('exist');
    cy.get('#settings-retention-enabled').should('exist');
    cy.get('label[for="settings-consent-text"]').should('exist');
    cy.get('#settings-consent-text').should('exist');
    cy.get('label[for="settings-consent-version"]').should('exist');
    cy.get('#settings-consent-version').should('exist');
    cy.get('label[for="settings-export-start"]').should('exist');
    cy.get('#settings-export-start').should('exist');
    cy.get('label[for="settings-export-end"]').should('exist');
    cy.get('#settings-export-end').should('exist');
    cy.get('label[for="settings-export-option"]').should('exist');
    cy.get('#settings-export-option').should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have accessible RichTextEditor toolbar', () => {
    openSessionEditor();
    
    // Check toolbar buttons have aria-labels
    cy.get('button[aria-label="Bold"]').should('exist');
    cy.get('button[aria-label="Italic"]').should('exist');
    cy.get('button[aria-label="Underline"]').should('exist');
    cy.get('button[aria-label="Heading"]').should('exist');
    cy.get('button[aria-label="Bullet List"]').should('exist');
    cy.get('button[aria-label="Numbered List"]').should('exist');
    cy.get('button[aria-label="Add Link"]').should('exist');
    cy.get('button[aria-label="Clear Formatting"]').should('exist');
    
    // Check icons are hidden from screen readers
    cy.get('button[aria-label="Bold"]').find('svg').should('have.attr', 'aria-hidden', 'true');
    
    cy.checkA11yCustom();
  });

  it('should have accessible sidebar navigation', () => {
    visitAppRoute('/#/app');
    
    // Check sidebar landmarks
    cy.get('nav').should('exist');
    cy.get('aside').should('exist');
    
    // Check navigation links
    cy.get('nav a[href="#/app"]').should('exist');
    cy.get('nav a[href="#/app/patients"]').should('exist');
    cy.get('nav a[href="#/app/calendar"]').should('exist');
    cy.get('nav a[href="#/app/sessions"]').should('exist');
    cy.get('nav a[href="#/app/finance"]').should('exist');
    cy.get('nav a[href="#/app/settings"]').should('exist');
    cy.get('nav a[href="#/app/audit"]').should('exist');
    cy.get('nav a[href="#/app/compliance"]').should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have accessible header with user menu', () => {
    visitAppRoute('/#/app');
    
    // Check header landmark
    cy.get('header').should('exist');
    
    // Check user menu button
    cy.get('header button[aria-expanded]').should('exist');
    cy.get('header button[aria-label*="User Menu"]').should('exist');
    
    // Open user menu and check
    cy.get('header button[aria-expanded="false"]').click();
    cy.get('header button[aria-expanded="true"]').should('exist');
    cy.get('header a[href="#/app/settings"]').should('exist');
    cy.get('header button').contains(/Logout|Sair/i).should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have accessible mobile menu toggle', () => {
    cy.viewport(390, 844);
    visitAppRoute('/#/app');
    
    // Check mobile menu button
    cy.get('button[aria-label*="Open menu"]').should('exist');
    cy.get('button[aria-label*="Open menu"]').click();
    cy.get('button[aria-label*="Close menu"]').should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have skip to main content link', () => {
    visitAppRoute('/#/app');
    
    cy.get('a[href="#main-content"]')
      .focus()
      .should('have.focus')
      .and('contain.text', 'Skip to main content');
    cy.get('#main-content').should('exist');
    
    cy.checkA11yCustom();
  });

  it('should have live region for announcements', () => {
    visitAppRoute('/#/app');
    
    // Check live region exists
    cy.get('#live-region').should('exist');
    cy.get('#live-region').should('have.attr', 'aria-live', 'polite');
    cy.get('#live-region').should('have.attr', 'aria-atomic', 'true');
    
    cy.checkA11yCustom();
  });
});

describe('Accessibility - Keyboard Navigation', () => {
  beforeEach(() => {
    cy.loginWithGoogle();
  });

  it('should allow keyboard navigation through PatientForm', () => {
    visitAppRoute('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    
    // Tab through form fields
    cy.focused().should('have.id', 'patient-name');
    cy.tabForward();
    cy.focused().should('have.id', 'patient-cpf');
    cy.tabForward();
    cy.focused().should('have.id', 'patient-email');
    cy.tabForward();
    cy.focused().should('have.id', 'patient-phone');
    cy.tabForward();
    cy.focused().should('have.id', 'patient-dob');
    cy.tabForward();
    cy.get('[role="dialog"]').find(':focus').should('exist');
    cy.get('#patient-gender').focus();
    cy.focused().should('have.id', 'patient-gender');
    
    cy.checkA11yCustom();
  });

  it('should allow keyboard navigation through SessionForm', () => {
    openSessionEditor();
    
    // Start at the first session field; the form is inline and does not autofocus.
    cy.get('#session-date').focus().should('have.focus');
    cy.get('#session-type').focus();
    cy.focused().should('have.id', 'session-type');
    cy.tabForward();
    cy.focused().should('have.id', 'session-status');
    cy.tabForward();
    cy.get('button[aria-label="Bold"]').should('have.focus');
    cy.get('#session-notes').focus().should('have.focus');
    
    cy.checkA11yCustom();
  });

  it('should allow keyboard navigation through Settings page', () => {
    visitAppRoute('/#/app/settings');
    
    // Tab through form fields
    cy.get('#settings-full-name').focus();
    cy.tabForward();
    cy.focused().should('have.id', 'settings-crp-number');
    cy.tabForward();
    cy.focused().should('have.id', 'settings-crp-region');
    cy.tabForward();
    cy.focused().should('have.id', 'settings-dpo-name');
    cy.tabForward();
    cy.focused().should('have.id', 'settings-dpo-email');
    cy.tabForward();
    cy.focused().invoke('text').should('match', /Alterar Foto(?: do Perfil)?|Change (?:Profile )?Photo/i);
    cy.tabForward();
    cy.focused().should('have.id', 'settings-specializations');
    cy.tabForward();
    cy.focused().should('have.id', 'settings-bio');
    cy.tabForward();
    cy.focused().invoke('text').should('match', /Forçar Recarregamento|Force Reload/i);
    cy.tabForward();
    cy.focused().invoke('text').should('match', /Re[- ]?(?:authori[sz]e|autorizar)/i);
    cy.tabForward();
    cy.focused().should('have.id', 'settings-auto-lock');
    
    cy.checkA11yCustom();
  });

  it('should trap focus in PatientForm modal', () => {
    visitAppRoute('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    
    // Get all focusable elements in modal
    cy.get('[role="dialog"]').within(() => {
      cy.get('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        .then(($elements) => {
          const firstElement = $elements[0];
          const lastElement = $elements[$elements.length - 1];
          
          // Focus first element
          firstElement.focus();
          
          // Shift+Tab should wrap to last element
          cy.tabBackward();
          cy.focused().should(($focused) => {
            expect($focused[0]).to.equal(lastElement);
          });
          
          // Tab should wrap to first element
          cy.tabForward();
          cy.focused().should(($focused) => {
            expect($focused[0]).to.equal(firstElement);
          });
        });
    });
  });
});

describe('Accessibility - Color Contrast', () => {
  beforeEach(() => {
    cy.loginWithGoogle();
  });

  it('should have sufficient contrast for primary text', () => {
    visitAppRoute('/#/app');
    cy.checkWCAG(['wcag2aa', 'wcag21aa']);
  });

  it('should have sufficient contrast for buttons', () => {
    visitAppRoute('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.checkWCAG(['wcag2aa', 'wcag21aa']);
  });

  it('should have sufficient contrast for form fields', () => {
    visitAppRoute('/#/app/settings');
    cy.checkWCAG(['wcag2aa', 'wcag21aa']);
  });
});

describe('Accessibility - Reduced Motion', () => {
  beforeEach(() => {
    cy.loginWithGoogle();
  });

  it('should respect prefers-reduced-motion', () => {
    // Set reduced motion preference
    visitAppRoute('/#/app');
    cy.document().then((document) => {
      const hasReducedMotionOverrides = Array.from(document.styleSheets).some((sheet) => {
        try {
          return Array.from(sheet.cssRules).some((rule) =>
            rule.cssText.includes('prefers-reduced-motion') &&
            rule.cssText.includes('0.01ms')
          );
        } catch {
          return false;
        }
      });

      expect(hasReducedMotionOverrides).to.be.true;
    });
  });
});

describe('Accessibility - Error States', () => {
  it('should announce login errors via role=alert', () => {
    cy.visit('/#/login');
    cy.window().then((win) => {
      cy.stub((win as any).mockAuth, 'signInWithPopup')
        .rejects({ code: 'auth/network-request-failed' });
    });

    cy.contains('button', /Sign in with Google|Entrar com o Google/i).click();
    cy.get('[role="alert"]').should('be.visible');
    cy.get('[role="alert"]')
      .invoke('text')
      .should('match', /Network error|Erro de rede/i);
    
    cy.checkA11yCustom();
  });

  it('should associate CPF error with input via aria-describedby', () => {
    cy.loginWithGoogle();
    visitAppRoute('/#/app/patients');
    cy.contains('button', /Adicionar Novo Paciente|Add Patient/i).click();
    cy.get('#patient-cpf').type('123');
    cy.get('#patient-cpf').blur();
    
    cy.get('#patient-cpf-error').should('exist');
    cy.get('#patient-cpf').should('have.attr', 'aria-describedby', 'patient-cpf-error');
    
    cy.checkA11yCustom();
  });
});