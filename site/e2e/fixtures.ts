import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { createBdd, test as base } from 'playwright-bdd';
import { removeTempDirs } from './support/temp';

// What a scenario declares it expects, so the guard below does not fail it for doing so on purpose.
export type Guard = {
  expectedMissing: Set<string>;
  expectInaccessible: boolean;
  // Set by a scenario whose browser refuses storage; any other must not say the run is not kept.
  storageBlocked: boolean;
  requests: URL[];
};

const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function accessibilityViolations(page: import('@playwright/test').Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcag).analyze();
  return violations;
}

// Every scenario of every story runs under this guard (NFR-D2, NFR-A8). It fails the scenario if
// the page asked any host but its own for anything, reported a Content Security Policy violation,
// asked the site for a file it does not have, ended in a state with an accessibility violation, or
// told the player their run is not kept when the browser was keeping it (not-kept-notice, failure 2).
// Per-scenario memory for steps that carry something from one step to the next (a set seen, a page
// opened in a new tab). A fixture, so nothing leaks from one scenario into the next.
export type World = { page?: import('@playwright/test').Page; [key: string]: unknown };

export const test = base.extend<{ guard: Guard; guarded: undefined; world: World }>({
  world: async ({}, use) => {
    await use({});
  },
  guard: async ({}, use) => {
    await use({
      expectedMissing: new Set(),
      expectInaccessible: false,
      storageBlocked: false,
      requests: [],
    });
  },
  guarded: [
    async ({ page, guard, baseURL }, use) => {
      if (!baseURL) throw new Error('guard: the Playwright config sets no baseURL');
      const origin = new URL(baseURL).origin;
      const offsite: string[] = [];
      const missing: string[] = [];
      const csp: string[] = [];
      page.on('request', (r) => {
        const url = new URL(r.url());
        guard.requests.push(url);
        if (/^https?:$/.test(url.protocol) && url.origin !== origin) offsite.push(r.url());
      });
      page.on('response', (r) => {
        const url = new URL(r.url());
        if (url.origin === origin && r.status() === 404 && !guard.expectedMissing.has(url.pathname))
          missing.push(url.pathname);
      });
      page.on('console', (m) => {
        if (/Content Security Policy/i.test(m.text())) csp.push(m.text());
      });

      try {
        await use(undefined);
      } finally {
        // The test's temporary folders go now, whatever happened in it (debt is-m2n).
        removeTempDirs();
      }

      expect(offsite, 'requests to a host other than the site').toEqual([]);
      expect(csp, 'Content Security Policy violations').toEqual([]);
      expect(missing, 'files of the site that answered 404').toEqual([]);
      // A scenario may close its page on purpose (closing the browser); there is nothing to check.
      const open = !page.isClosed() && page.url() !== 'about:blank';
      if (open && !guard.storageBlocked) {
        await expect(
          page.locator('.storage-notice'),
          'a not-kept notice with storage working',
        ).toHaveCount(0);
      }
      if (!guard.expectInaccessible && open) {
        const violations = await accessibilityViolations(page);
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
          `accessibility violations on ${page.url()}`,
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});

export const { Given, When, Then } = createBdd(test);
