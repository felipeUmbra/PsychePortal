import { test, expect } from './test-fixtures';

const PAGES = [
  { name: 'Dashboard', url: '/#/app/dashboard', heading: /Dashboard/i },
  { name: 'Patients', url: '/#/app/patients', heading: /Diretório de Pacientes|Patients/i },
  { name: 'Sessions', url: '/#/app/sessions', heading: /Sessões|Sessions/i },
  { name: 'Calendar', url: '/#/app/calendar', heading: /Calendário|Calendar/i },
  { name: 'Finance', url: '/#/app/finance', heading: /Financeiro|Finance/i },
  { name: 'Settings', url: '/#/app/settings', heading: /Configurações|Settings/i },
  { name: 'Audit Log', url: '/#/app/audit-log', heading: /Log de Auditoria|Audit Log/i },
  { name: 'Compliance', url: '/#/app/compliance', heading: /Conformidade|Compliance/i },
  { name: 'Encryption', url: '/#/app/encryption', heading: /Criptografia|Encryption/i },
];

for (const { name, url, heading } of PAGES) {
  test.describe(`${name} accessibility @accessibility`, () => {
    test.beforeEach(async ({ page, login }) => {
      await login();
      await page.goto(url);
      await page.getByText(heading).first().waitFor({ state: 'visible' });
    });

    test('has no accessibility violations', async ({ checkA11yCustom }) => {
      await checkA11yCustom();
    });

    test('meets WCAG AA criteria', async ({ checkWCAG }) => {
      await checkWCAG(['wcag2aa', 'wcag21aa']);
    });

    test('meets WCAG AAA criteria for contrast', async ({ checkWCAG }) => {
      await checkWCAG(['wcag2aaa', 'wcag21aaa']);
    });
  });
}

test.describe('Responsive accessibility @accessibility', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
  ];

  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
      test.use({ viewport });

      test('Patients page has no violations', async ({ page, login, checkA11yCustom }) => {
        await login();
        await page.goto('/#/app/patients');
        await page.getByText(/Diretório de Pacientes|Patients/i).first().waitFor({ state: 'visible' });
        await checkA11yCustom();
      });
    });
  }
});

test.describe('Keyboard navigation @accessibility', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/#/app/patients');
    await page.getByText(/Diretório de Pacientes|Patients/i).first().waitFor({ state: 'visible' });
  });

  test('can navigate with Tab key', async ({ page, tabForward }) => {
    await tabForward();
    await expect(page.locator(':focus')).toBeVisible();

    // Tab through several elements
    for (let i = 0; i < 5; i++) {
      await tabForward();
    }
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('can navigate backwards with Shift+Tab', async ({ page, tabForward, tabBackward }) => {
    await tabForward();
    await tabForward();
    const firstFocused = page.locator(':focus');

    await tabBackward();
    await expect(page.locator(':focus')).not.toEqual(firstFocused);
  });

  test('focus is visible on interactive elements', async ({ page, tabForward, shouldHaveVisibleFocus }) => {
    await tabForward();
    await shouldHaveVisibleFocus();
  });
});
