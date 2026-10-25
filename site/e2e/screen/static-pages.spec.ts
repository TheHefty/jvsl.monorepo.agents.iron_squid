// The static pages the build writes, the root above all, checked for accessibility like every other
// page (defect is-8qd). The root sends the browser on at once with a meta refresh, so the guard, which
// checks the page a test ends on, never saw it. Here each static page is served as built, minus the
// refresh (not an accessibility property), and held still for axe, in both colour schemes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { accessibilityViolations, test } from '../fixtures';
import { pagesOfBuild, siteDir } from '../support/pages';

const staticPages = pagesOfBuild().filter(
  (p) =>
    !readFileSync(join(siteDir, p.endsWith('.html') ? p : `${p}index.html`), 'utf8').includes(
      '<script',
    ),
);

test('the build has static pages to check', () => {
  expect(staticPages.length).toBeGreaterThan(0);
});

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`in the ${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    for (const p of staticPages) {
      test(`${p || 'the root'} has no accessibility violation`, async ({ page, baseURL }) => {
        const url = new URL(p, baseURL).href;
        const html = readFileSync(
          join(siteDir, p.endsWith('.html') ? p : `${p}index.html`),
          'utf8',
        );
        await page.route(url, (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: html.replace(/<meta http-equiv="refresh"[^>]*>/, ''),
          }),
        );
        await page.goto(url);
        // The page held still is the page that was built: its footer and notices are there.
        await expect(page.getByRole('contentinfo')).toBeVisible();
        const violations = await accessibilityViolations(page);
        expect(
          violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
        ).toEqual([]);
      });
    }
  });
}
