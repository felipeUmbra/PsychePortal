// Accessibility testing support for Cypress
import 'cypress-axe';

// Add custom command for accessibility testing
Cypress.Commands.add('checkA11yCustom', (context?: string, options?: any) => {
  cy.document().then((document) => {
    const finiteAnimations = Array.from(document.querySelectorAll('*'))
      .flatMap((element) => element.getAnimations())
      .filter((animation) => {
      const iterations = animation.effect?.getComputedTiming().iterations;
      return animation.playState === 'running' && iterations !== Infinity;
    });

    return Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => undefined)));
  });
  cy.injectAxe();
  cy.checkA11y(context, options, (violations) => {
    // Log violations for debugging
    cy.task('log', `Accessibility violations found: ${violations.length}`);
    violations.forEach((violation: any) => {
      cy.task('log', `${violation.id}: ${violation.description}`);
      violation.nodes.forEach((node: any) => {
        cy.task('log', `  Target: ${node.target.join(', ')}`);
        cy.task('log', `  HTML: ${node.html}`);
      });
    });
    
    // Fail the test if there are violations
    if (violations.length > 0) {
      const details = violations.map((violation: any) => {
        const targets = violation.nodes
          .map((node: any) => node.target.join(', '))
          .join('; ');
        const summaries = violation.nodes
          .map((node: any) => node.failureSummary)
          .filter(Boolean)
          .join('; ');
        return `${violation.id} (${targets})${summaries ? `: ${summaries}` : ''}`;
      }).join('\n');
      throw new Error(`Accessibility violations found: ${violations.length}\n${details}`);
    }
  });
});

// Add command to check specific WCAG criteria
Cypress.Commands.add('checkWCAG', (criteria: string[], context?: string) => {
  cy.document().then((document) => {
    const finiteAnimations = Array.from(document.querySelectorAll('*'))
      .flatMap((element) => element.getAnimations())
      .filter((animation) => {
      const iterations = animation.effect?.getComputedTiming().iterations;
      return animation.playState === 'running' && iterations !== Infinity;
    });

    return Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => undefined)));
  });
  cy.injectAxe();
  cy.checkA11y(context, {
    runOnly: {
      type: 'tag',
      values: criteria
    }
  });
});

// Add command for keyboard navigation testing
Cypress.Commands.add('tabForward', () => {
  cy.press(Cypress.Keyboard.Keys.TAB);
});

Cypress.Commands.add('tabBackward', () => {
  cy.focused().realPress(['Shift', 'Tab']);
});

// Add command to verify focus is visible
Cypress.Commands.add('shouldHaveVisibleFocus', () => {
  cy.focused().should('have.class', 'focus-visible:ring-2');
});

// Add command to check color contrast
Cypress.Commands.add('checkContrast', (selector: string) => {
  cy.get(selector).then(($el) => {
    const styles = window.getComputedStyle($el[0]);
    const color = styles.color;
    const backgroundColor = styles.backgroundColor;
    // This is a basic check - in practice you'd use a proper contrast calculator
    cy.task('log', `Element ${selector}: color=${color}, background=${backgroundColor}`);
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      checkA11yCustom(context?: string, options?: any): Chainable<void>;
      checkWCAG(criteria: string[], context?: string): Chainable<void>;
      tabForward(): Chainable<void>;
      tabBackward(): Chainable<void>;
      shouldHaveVisibleFocus(): Chainable<void>;
      checkContrast(selector: string): Chainable<void>;
    }
  }
}