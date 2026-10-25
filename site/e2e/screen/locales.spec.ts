// Every locale's pages fit a narrow phone (task translations, failure 3): German and Russian words
// are longer than English ones, and a translation that overflows shows only in its own language.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import { locales } from '../../src/i18n/locales';
import { encodeShare } from '../../src/share/link';
import { test } from '../fixtures';
import { playRun, seedRunScript, winsThenPlaying } from '../support/seed';

const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const run = playRun([...winsThenPlaying(12), 'loss'], 'Inkling Ivo');

test.describe('on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const locale of locales) {
    test(`every page in ${locale} fits the width`, async ({ page }) => {
      await seedRunScript(page, run);
      for (const path of ['', 'terms/', 'privacy/', `run/#${encodeShare(run, catalogue)}`]) {
        await page.goto(`./${locale}/${path}`);
        await expect(page.getByRole('contentinfo')).toBeVisible();
        if (path === '') await page.locator('details.run-log summary').click();
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(width, `${locale}/${path.split('#')[0]} is ${width}px wide`).toBeLessThanOrEqual(
          320,
        );
      }
    });
  }
});
