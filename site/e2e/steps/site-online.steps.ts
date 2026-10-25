import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { accessibilityViolations, Given, Then, When } from '../fixtures';
import { pagesOfBuild, timeForEveryPage } from '../support/pages';

const catalogue = JSON.parse(
  readFileSync(new URL('../../src/i18n/messages/en-US.json', import.meta.url), 'utf8'),
) as Record<string, string>;
const message = (id: string): string => {
  const text = catalogue[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return text;
};
const missingAddress = 'no-such-page/';

When('a visitor opens the root of the domain', async ({ page }) => {
  await page.goto('./');
});

Then('they arrive at the {string} address', async ({ page, baseURL }, address: string) => {
  await expect(page).toHaveURL(new URL(`.${address}`, baseURL).href);
});

When('a visitor opens an address the site does not have', async ({ page, guard, baseURL }) => {
  const url = new URL(missingAddress, baseURL);
  guard.expectedMissing.add(url.pathname);
  const response = await page.goto(url.href);
  expect(response?.status()).toBe(404);
});

Then('they see a page that says the page does not exist', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(message('notFound.title'));
});

Then('it links back to the home page', async ({ page, baseURL }) => {
  const link = page.getByRole('link', { name: message('notFound.home') });
  await expect(link).toHaveAttribute('href', new URL('en-US/', baseURL).pathname);
});

Given('a page that has a control with no accessible name', async ({ page, guard }) => {
  guard.expectInaccessible = true;
  await page.setContent('<html lang="en"><title>t</title><main><button></button></main></html>');
});

let violations: Awaited<ReturnType<typeof accessibilityViolations>> = [];

When('the accessibility check runs on it', async ({ page }) => {
  violations = await accessibilityViolations(page);
});

Then('the check fails, naming the control', async () => {
  const buttonName = violations.find((v) => v.id === 'button-name');
  expect(buttonName, 'a button-name violation').toBeDefined();
  expect(buttonName?.nodes.map((n) => n.target.join(' '))).toEqual(['button']);
});

Given('the published site', async () => {
  // The build under test: every HTML page it contains is a page a visitor can reach.
});

When('a visitor loads every page', async ({ page, guard, baseURL, world, $test }) => {
  $test.setTimeout(timeForEveryPage());
  const pages = pagesOfBuild();
  expect(pages.length, 'pages in the build').toBeGreaterThan(0);
  for (const p of pages) {
    const url = new URL(p, baseURL);
    if (p === '404.html') guard.expectedMissing.add(url.pathname);
    await page.goto(url.href);
    await page.waitForLoadState('networkidle');
    // Paragraphs drawn turned, by their own transform or an ancestor's (design-alignment).
    const turned = await page.evaluate(() =>
      [...document.querySelectorAll('p')]
        .filter((p) => {
          for (let el: Element | null = p; el; el = el.parentElement) {
            const t = getComputedStyle(el).transform;
            const m = t === 'none' ? null : new DOMMatrixReadOnly(t);
            if (m && (Math.abs(m.b) > 1e-6 || Math.abs(m.c) > 1e-6)) return true;
          }
          return false;
        })
        .map((p) => (p.textContent ?? '').slice(0, 40)),
    );
    world.turned = [
      ...((world.turned as string[] | undefined) ?? []),
      ...turned.map((t) => `${p}: ${t}`),
    ];
  }
});

Then("no request is made to any host other than the site's own", async ({ guard, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  const offsite = guard.requests.filter((u) => /^https?:$/.test(u.protocol) && u.origin !== origin);
  expect(offsite.map(String)).toEqual([]);
  expect(guard.requests.length, 'requests observed').toBeGreaterThan(0);
});
