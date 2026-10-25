import { readdirSync } from 'node:fs';
import { expect } from '@playwright/test';
import { latestVersion } from '../../src/catalogue/latest';
import { Then, When } from '../fixtures';
import { localeOfPage, messageIn } from '../support/messages';
import { pagesOfBuild, timeForEveryPage } from '../support/pages';

const footers = new Map<string, string>();

When('a visitor opens any page', async ({ page, request, guard, baseURL, $test }) => {
  $test.setTimeout(timeForEveryPage());
  for (const p of pagesOfBuild()) {
    const url = new URL(p, baseURL);
    if (p === '404.html') guard.expectedMissing.add(url.pathname);
    // A page without the app script is static, and may send the browser on at once (the root's
    // meta refresh): read its footer from the HTML as served, or the next page's would be read.
    const html = await (await request.get(url.href)).text();
    if (!html.includes('<script')) {
      const footer = /<footer[^>]*>([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? '';
      footers.set(p, footer.replace(/<[^>]+>/g, ''));
      continue;
    }
    await page.goto(url.href);
    footers.set(p, (await page.getByRole('contentinfo').textContent()) ?? '');
  }
});

Then(
  'the page says the catalogue matches Splatoon 3 version {word}',
  async ({}, version: string) => {
    // The version the scenario names must be the one the build draws from, read from the data.
    const built = latestVersion(
      readdirSync('src/catalogue', { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name),
    );
    expect(built).toBe(version);
    expect(footers.size, 'pages in the build').toBeGreaterThan(0);
    // The footer also carries the notices (FR-50, FR-51); the version line, in the page's own
    // language, must be among them.
    for (const [p, text] of footers)
      expect(text, `the footer of ${p || 'the root'}`).toContain(
        messageIn(localeOfPage(p), 'catalogue.version', { version }),
      );
  },
);
