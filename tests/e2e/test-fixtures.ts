import { test as base, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { AxeResults } from 'axe-core';
import { expect } from '@playwright/test';

// Type for our custom fixtures
type TestFixtures = {
  login: () => Promise<void>;
  mockDriveApi: () => Promise<void>;
  mockCalendarApi: () => Promise<void>;
  openPatientCard: (name: string) => Promise<void>;
  checkA11yCustom: (context?: string, options?: any) => Promise<void>;
  checkWCAG: (criteria: string[], context?: string) => Promise<void>;
  tabForward: () => Promise<void>;
  tabBackward: () => Promise<void>;
  shouldHaveVisibleFocus: () => Promise<void>;
};

// Inject playwright flag before tests run so MockAuth is enabled
// This mirrors how Cypress injects window.Cypress
async function injectPlaywrightFlag(page: Page) {
  await page.addInitScript(() => {
    (window as any).playwright = true;
    try {
      localStorage.setItem('cookie_consent', 'accepted');
    } catch {}
  });
}

// Helper functions
async function mockDriveApiImpl(page: Page) {
  let savedDriveContent: any = null;

  try {
    await page.exposeFunction('__playwright_saveDriveContent', (jsonString: string) => {
      try {
        savedDriveContent = JSON.parse(jsonString);
      } catch (e) {
        console.error('[MOCK DRIVE] Error parsing exposed drive content:', e);
      }
    });
  } catch {
    // exposeFunction throws if already registered on the page
  }

  await page.addInitScript(() => {
    const origFetch = window.fetch;
    window.fetch = async function(input: any, init?: any) {
      if (init && init.body instanceof FormData && typeof input === 'string' && input.includes('/drive/v3/files')) {
        const file = init.body.get('file');
        if (file instanceof Blob && typeof (window as any).__playwright_saveDriveContent === 'function') {
          try {
            const text = await file.text();
            await (window as any).__playwright_saveDriveContent(text);
          } catch {}
        }
      }
      return origFetch.apply(this, arguments as any);
    };
  });

  await page.route(/\/drive\/v3\/files/, async route => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET') {
      if (url.includes('alt=media')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(savedDriveContent || { patients: [], sessions: [], psychologists: [], audit_logs: [] })
        });
      } else {
        if (savedDriveContent) {
          await route.fulfill({
            status: 200,
            json: { files: [{ id: 'mock-drive-file', name: 'workspace.json' }] }
          });
        } else {
          await route.fulfill({ status: 200, json: { files: [] } });
        }
      }
    } else if (method === 'POST' || method === 'PATCH') {
      const req = route.request();
      const pData = req.postData();
      const pBuf = req.postDataBuffer();
      const postData = pData || pBuf?.toString('utf-8');
      if (postData) {
        try {
          const filePart = postData.includes('name="file"') ? postData.split('name="file"')[1] : postData;
          const jsonStart = filePart.indexOf('{');
          const jsonEnd = filePart.lastIndexOf('}');
          if (jsonStart !== -1 && jsonEnd !== -1) {
            savedDriveContent = JSON.parse(filePart.substring(jsonStart, jsonEnd + 1));
          }
        } catch (e) {
          console.error('[MOCK DRIVE] Error parsing mock drive postData:', e);
        }
      }
      await route.fulfill({ status: 200, json: { id: 'mock-drive-file' } });
    } else {
      await route.continue();
    }
  });
}

async function mockCalendarApiImpl(page: Page) {
  await page.route(/\/googleapis\.com\/calendar\/v3\/.*events/, async route => {
    await route.fulfill({ status: 200, json: { id: 'mock-calendar-event' } });
  });
}

async function doLogin(page: Page) {
  await injectPlaywrightFlag(page);
  await mockDriveApiImpl(page);
  await mockCalendarApiImpl(page);

  await page.goto('/#/login');
  await page.getByRole('button', { name: /entrar com o google|sign in with google/i }).click();
  await page.waitForURL(/\/app/);
}

async function openPatientCardImpl(page: Page, name: string) {
  const card = page.locator('.card', { hasText: name }).first();
  await card.waitFor({ timeout: 10000 });
  await card.locator('a').first().click();

  const h1 = page.locator('h1').first();
  await h1.waitFor({ timeout: 15000 });

  const h1Text = await h1.textContent();
  if (!h1Text?.includes(name)) {
    await page.getByRole('link', { name: /Pacientes|Patients/i }).click();
    await page.locator('.card', { hasText: name }).first().locator('a').first().click();
    await page.locator('h1', { hasText: name }).first().waitFor({ timeout: 15000 });
  }
}

async function checkA11yCustomImpl(page: Page, context?: string, options?: any) {
  await page.evaluate(() => {
    const animations = Array.from(document.querySelectorAll('*'))
      .flatMap(el => el.getAnimations())
      .filter(anim => anim.playState === 'running' &&
        anim.effect?.getComputedTiming().iterations !== Infinity);
    return Promise.all(animations.map(anim => anim.finished.catch(() => undefined)));
  });

  const builder = new AxeBuilder({ page });
  if (context) {
    builder.include(context);
  }
  if (options) {
    builder.withOptions(options);
  }
  const results = await builder.analyze();

  if (results.violations.length > 0) {
    const details = results.violations.map(v => {
      const targets = v.nodes.map(n => n.target.join(', ')).join('; ');
      const summaries = v.nodes.map(n => n.failureSummary).filter(Boolean).join('; ');
      return `${v.id} (${targets})${summaries ? `: ${summaries}` : ''}`;
    }).join('\n');
    throw new Error(`Accessibility violations found: ${results.violations.length}\n${details}`);
  }
}

async function checkWCAGImpl(page: Page, criteria: string[], context?: string) {
  await page.evaluate(() => {
    const animations = Array.from(document.querySelectorAll('*'))
      .flatMap(el => el.getAnimations())
      .filter(anim => anim.playState === 'running' &&
        anim.effect?.getComputedTiming().iterations !== Infinity);
    return Promise.all(animations.map(anim => anim.finished.catch(() => undefined)));
  });

  const builder = new AxeBuilder({ page });
  if (context) {
    builder.include(context);
  }
  builder.withTags(criteria);
  const results = await builder.analyze();

  if (results.violations.length > 0) {
    const details = results.violations.map(v => {
      const targets = v.nodes.map(n => n.target.join(', ')).join('; ');
      const summaries = v.nodes.map(n => n.failureSummary).filter(Boolean).join('; ');
      return `${v.id} (${targets})${summaries ? `: ${summaries}` : ''}`;
    }).join('\n');
    throw new Error(`Accessibility violations found: ${results.violations.length}\n${details}`);
  }
}

async function tabForwardImpl(page: Page) {
  await page.keyboard.press('Tab');
}

async function tabBackwardImpl(page: Page) {
  await page.keyboard.press('Shift+Tab');
}

async function shouldHaveVisibleFocusImpl(page: Page) {
  await expect(page.locator(':focus-visible')).toBeVisible();
}

// Extended test with our custom fixtures
export const test = base.extend<TestFixtures>({
  login: async ({ page }, use) => {
    await use(async () => doLogin(page));
  },

  mockDriveApi: async ({ page }, use) => {
    await use(async () => mockDriveApiImpl(page));
  },

  mockCalendarApi: async ({ page }, use) => {
    await use(async () => mockCalendarApiImpl(page));
  },

  openPatientCard: async ({ page }, use) => {
    await use(async (name: string) => openPatientCardImpl(page, name));
  },

  checkA11yCustom: async ({ page }, use) => {
    await use(async (context?: string, options?: any) => checkA11yCustomImpl(page, context, options));
  },

  checkWCAG: async ({ page }, use) => {
    await use(async (criteria: string[], context?: string) => checkWCAGImpl(page, criteria, context));
  },

  tabForward: async ({ page }, use) => {
    await use(async () => tabForwardImpl(page));
  },

  tabBackward: async ({ page }, use) => {
    await use(async () => tabBackwardImpl(page));
  },

  shouldHaveVisibleFocus: async ({ page }, use) => {
    await use(async () => shouldHaveVisibleFocusImpl(page));
  },
});

// Re-export expect for convenience
export { expect };