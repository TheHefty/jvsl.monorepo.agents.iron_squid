import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { locales } from '../../src/i18n/locales';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';

const autonyms = JSON.parse(readFileSync('src/i18n/autonyms.json', 'utf8')) as Record<
  string,
  string
>;
const localeOf = (address: string) => address.replace(/\//g, '');
const pageLocale = async (p: Page) => (await p.locator('html').getAttribute('lang')) ?? '';

// The switcher, opened, in the page's own language.
async function openSwitcher(p: Page) {
  const locale = await pageLocale(p);
  const nav = p.getByRole('navigation', { name: messageIn(locale, 'language.label') });
  await nav.locator('summary').click();
  return nav;
}

async function switchTo(p: Page, autonym: string) {
  const nav = await openSwitcher(p);
  await nav.getByRole('link', { name: autonym, exact: true }).click();
}

Given(
  'a visitor with a run in progress, on the {string} address',
  async ({ page, world }, address: string) => {
    await seedRun(page, playRun(winsThenPlaying(4), 'Inkling Ivo'), localeOf(address));
    await expect(page.locator('.run-title')).toHaveText('Inkling Ivo');
    world.stored = await page.evaluate(() => localStorage.getItem('iron-squid:run'));
    world.set = await page
      .locator('.set-card img')
      .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src')));
  },
);

When('the visitor switches to {string}', async ({ page }, autonym: string) => {
  await switchTo(page, autonym);
});

Then(
  'the visitor is on the {string} address of the same page',
  async ({ page, baseURL }, address: string) => {
    await expect(page).toHaveURL(new URL(`.${address}`, baseURL).href);
    expect(await pageLocale(page)).toBe(localeOf(address));
  },
);

Then('the run is unchanged', async ({ page, world }) => {
  await expect(page.locator('.run-title')).toHaveText('Inkling Ivo');
  expect(await page.evaluate(() => localStorage.getItem('iron-squid:run'))).toBe(world.stored);
  // The same set, by its images: the names are now in the other language.
  expect(
    await page
      .locator('.set-card img')
      .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src'))),
  ).toEqual(world.set);
});

Given('a visitor who switched to {string}', async ({ page }, autonym: string) => {
  await page.goto('./en-US/');
  await switchTo(page, autonym);
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

When('the visitor opens a link to the {string} address', async ({ page }, address: string) => {
  await page.goto(`.${address}`);
});

Then('the page is in Korean', async ({ page }) => {
  expect(await pageLocale(page)).toBe('ko-KR');
  await expect(page.getByRole('contentinfo')).toContainText(messageIn('ko-KR', 'footer.terms'));
});

When('a visitor opens the language switcher', async ({ page, world }) => {
  await page.goto('./en-US/');
  world.nav = await openSwitcher(page);
});

Then(
  'each language is listed by its own name, such as {string} and {string}',
  async ({ page }, first: string, second: string) => {
    const nav = page.getByRole('navigation', { name: messageIn('en-US', 'language.label') });
    const names = await nav.getByRole('link').allInnerTexts();
    expect(names).toEqual(locales.map((l) => autonyms[l]));
    expect(names).toEqual(expect.arrayContaining([first, second]));
  },
);

Given('a visitor using only a keyboard', async ({ page }) => {
  await page.goto('./en-US/');
});

Then('the visitor can reach the language switcher and choose any language', async ({ page }) => {
  const summary = page
    .getByRole('navigation', { name: messageIn('en-US', 'language.label') })
    .locator('summary');
  // Tab until the switcher has the focus, then open it and Tab to Japanese.
  for (let i = 0; i < 30 && !(await summary.evaluate((s) => s === document.activeElement)); i++)
    await page.keyboard.press('Tab');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.textContent)) === autonyms['ja-JP'])
      break;
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/ja-JP\/$/);
});
