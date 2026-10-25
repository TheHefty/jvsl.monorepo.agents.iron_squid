// Every locale's pages fit a narrow phone (task translations, failure 3): German and Russian words
// are longer than English ones, and a translation that overflows shows only in its own language.
//
// The run is the worst one for each locale, never a random one: the items with the longest names
// in that language are put in the conquered set and in the set on screen. A random draw passed or
// failed by chance, depending on whether a Dutch "Wereldtourneehoofdtelefoon" was among its sets.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import type { Catalogue, NamesFile } from '../../src/catalogue/types';
import { locales } from '../../src/i18n/locales';
import type { RunState } from '../../src/run/engine';
import { encodeShare } from '../../src/share/link';
import { test } from '../fixtures';
import { playRun, seedRunScript, winsThenPlaying } from '../support/seed';

const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;

// A run with one set conquered and one on screen, made of the longest-named items in the locale.
function longestNames(locale: string): RunState {
  const { names } = JSON.parse(
    readFileSync(`src/catalogue/11.3.0/names/${locale}.json`, 'utf8'),
  ) as NamesFile;
  const longestWord = (id: string) =>
    Math.max(...(names[id] ?? '').split(/\s+/).map((w) => w.length));
  const state = playRun([...winsThenPlaying(1)], 'Inkling Ivo');
  for (const slot of ['kits', 'head', 'clothes', 'shoes'] as const) {
    const order = state.order[slot];
    const ranked = [...order].sort((a, b) => longestWord(b) - longestWord(a));
    // Moved to draws 0 and 1 by swapping, so the order is still the same items, each once.
    for (const [draw, id] of [ranked[0], ranked[1]].entries()) {
      const at = order.indexOf(id ?? '');
      [order[draw], order[at]] = [order[at] ?? '', order[draw] ?? ''];
    }
  }
  return state;
}

test.describe('on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  for (const locale of locales) {
    test(`every page in ${locale} fits the width, with its longest names`, async ({ page }) => {
      const run = longestNames(locale);
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
