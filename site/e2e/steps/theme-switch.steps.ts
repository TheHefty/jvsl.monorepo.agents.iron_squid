import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Catalogue } from '../../src/catalogue/types';
import { encodeShare } from '../../src/share/link';
import { accessibilityViolations, Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { playRun, seedRunScript, winsThenPlaying } from '../support/seed';

// The ground of each theme, as tokens.css paints the page (rgb of --color-bg).
const ground = { light: 'rgb(243, 245, 254)', dark: 'rgb(22, 24, 38)' } as const;
type Theme = keyof typeof ground;
const control = (p: Page, theme: 'Light' | 'Dark') =>
  p.getByRole('group', { name: messageIn('en-US', 'theme.label') }).getByRole('button', {
    name: messageIn('en-US', theme === 'Light' ? 'theme.light' : 'theme.dark'),
  });
const themeOf = (p: Page) => p.evaluate(() => getComputedStyle(document.body).backgroundColor);
const expectTheme = async (p: Page, theme: Theme) =>
  expect.poll(() => themeOf(p), { timeout: 2000 }).toBe(ground[theme]);

Given('a device set to a light appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
});

When('a visitor opens the site for the first time', async ({ page }) => {
  await page.goto('./en-US/');
});

Then('the site is in the light theme', async ({ page, world }) => {
  await expectTheme((world.page as Page | undefined) ?? page, 'light');
});

Then('the site is in the dark theme', async ({ page, world }) => {
  const p = (world.page as Page | undefined) ?? page;
  await expectTheme(p, 'dark');
  // From the first paint, not after it: the theme the page had when its document was parsed.
  if (world.page)
    expect(
      await p.evaluate(() => (window as unknown as { themeAtLoad?: string }).themeAtLoad),
    ).toBe('dark');
});

Then("the header's theme control shows {string} as chosen", async ({ page }, theme: string) => {
  await expect(control(page, theme as 'Light')).toHaveAttribute('aria-pressed', 'true');
});

Given('a visitor on the light theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./en-US/');
  await expectTheme(page, 'light');
});

When('the visitor chooses {string} in the header', async ({ page }, theme: string) => {
  // A mark on the window: a reload would lose it.
  await page.evaluate(() => ((window as unknown as { same?: boolean }).same = true));
  await control(page, theme as 'Dark').click();
});

Then('the site is in the dark theme at once, without reloading', async ({ page }) => {
  await expectTheme(page, 'dark');
  expect(await page.evaluate(() => (window as unknown as { same?: boolean }).same)).toBe(true);
});

Given(
  'a visitor who chose {string} on a device set to a light appearance',
  async ({ page }, theme: string) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./en-US/');
    await control(page, theme as 'Dark').click();
  },
);

When(
  'the visitor closes the browser and opens the site again',
  async ({ page, world, browser, baseURL }) => {
    const storageState = await page.context().storageState();
    await page.context().close();
    const next = await (
      await browser.newContext({ storageState, baseURL, colorScheme: 'light' })
    ).newPage();
    // Records the theme as the document is parsed, before anything paints (failure 1).
    await next.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { themeAtLoad?: string }).themeAtLoad = getComputedStyle(
          document.documentElement,
        ).colorScheme.includes('dark')
          ? 'dark'
          : 'light';
      });
    });
    await next.goto('./en-US/');
    world.page = next;
  },
);

Given('a visitor who chose {string}', async ({ page }, theme: string) => {
  await page.emulateMedia({ colorScheme: theme === 'Light' ? 'dark' : 'light' });
  await page.goto('./en-US/');
  await control(page, theme as 'Light').click();
});

Then('the site is still in the light theme', async ({ page }) => {
  await expect(page).toHaveURL(/\/ja-JP\/$/);
  await expectTheme(page, 'light');
});

Then('the header has the theme control', async ({ page, world, baseURL }) => {
  for (const p of (world.pages as { path: string; app: boolean }[]).filter(
    (q) => q.app && q.path !== '404.html',
  )) {
    await page.goto(new URL(p.path, baseURL).href);
    await expect(page.getByRole('banner').locator('.theme-switch button')).toHaveCount(2);
  }
});

Then('the visitor can reach the theme control and choose either theme', async ({ page }) => {
  for (const theme of ['Dark', 'Light'] as const) {
    const button = control(page, theme);
    for (let i = 0; i < 40 && !(await button.evaluate((b) => b === document.activeElement)); i++)
      await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    await page.keyboard.press('Enter');
    await expectTheme(page, theme === 'Dark' ? 'dark' : 'light');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
});

Given('the site is in the {word} theme', async ({ page, world }, theme: string) => {
  // Chosen against the device's own setting, so the forced theme is what is checked (failure 2).
  await page.emulateMedia({ colorScheme: theme === 'light' ? 'dark' : 'light' });
  await page.addInitScript((t) => localStorage.setItem('iron-squid:theme', t), theme);
  world.theme = theme;
});

When(
  'a visitor loads every page and every state of a run',
  async ({ page, world, guard, baseURL, $test }) => {
    // The page that does not exist is one of them, on purpose.
    guard.expectedMissing.add(new URL('./en-US/nowhere/', baseURL).pathname);
    $test.setTimeout(180_000);
    const catalogue = JSON.parse(
      readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
    ) as Catalogue;
    const states = {
      start: undefined,
      playing: playRun(winsThenPlaying(3)),
      conquered: playRun([...winsThenPlaying(3), 'win']),
      reset: playRun([...winsThenPlaying(4), 'loss', 'loss']),
      complete: playRun([...winsThenPlaying(159), 'win']),
    };
    const seen: Record<string, string[]> = {};
    const check = async (label: string) => {
      await expectTheme(page, world.theme as Theme);
      seen[label] = (await accessibilityViolations(page)).map((v) => v.id);
    };
    for (const [label, state] of Object.entries(states)) {
      const fresh = await page.context().newPage();
      await fresh.emulateMedia({ colorScheme: world.theme === 'light' ? 'dark' : 'light' });
      await fresh.addInitScript(
        (t) => localStorage.setItem('iron-squid:theme', t),
        world.theme as string,
      );
      if (state) await seedRunScript(fresh, state);
      await fresh.goto('./en-US/');
      await expect(fresh.getByRole('contentinfo')).toBeVisible();
      await expectTheme(fresh, world.theme as Theme);
      seen[`run: ${label}`] = (await accessibilityViolations(fresh)).map((v) => v.id);
      await fresh.close();
    }
    for (const path of [
      'terms/',
      'privacy/',
      `run/#${encodeShare(states.playing, catalogue)}`,
      'nowhere/',
    ]) {
      await page.goto(`./en-US/${path}`);
      await expect(page.getByRole('contentinfo')).toBeVisible();
      await check(path.split('#')[0] ?? path);
    }
    world.violations = seen;
  },
);

Then('no page has an accessibility violation', async ({ world }) => {
  const found = Object.entries(world.violations as Record<string, string[]>).filter(
    ([, v]) => v.length,
  );
  expect(found).toEqual([]);
});

Then('it says the theme choice is kept in the browser and never sent', async ({ page }) => {
  await expect(page.getByRole('article')).toContainText(messageIn('en-US', 'privacy.item.theme'));
  await expect(page.getByRole('article')).toContainText(messageIn('en-US', 'privacy.where'));
});
