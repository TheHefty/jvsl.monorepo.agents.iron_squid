import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Catalogue, NamesFile } from '../../src/catalogue/types';
import type { RunState } from '../../src/run/engine';
import { encodeShare } from '../../src/share/link';
import { Given, Then, When } from '../fixtures';
import { basePath } from '../site-under-test';
import { messageIn } from '../support/messages';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';

const version = '11.3.0';
const catalogue = JSON.parse(
  readFileSync(`src/catalogue/${version}/catalogue.json`, 'utf8'),
) as Catalogue;
const namesIn = (locale: string) =>
  (JSON.parse(readFileSync(`src/catalogue/${version}/names/${locale}.json`, 'utf8')) as NamesFile)
    .names;
const slots = ['head', 'clothes', 'shoes'] as const;

// The brand each gear piece of draw n wears, head, clothes and shoes.
const brandsOf = (state: RunState, n: number) =>
  slots.map((slot) => {
    const id = state.order[slot][n];
    const piece = catalogue.gear[slot].find((g) => g.id === id);
    if (!piece) throw new Error(`steps: ${String(id)} is not in catalogue ${version}`);
    return piece.brand;
  });
// Where the site serves an icon: under the path it was built for, which CI also builds as a project
// page (BASE_PATH), not only at the root.
const iconSrc = (brand: string) => `${basePath}game/${version}/brand/${brand}.png`;

// The run as the page stored it, to know which set is on screen.
const stored = async (p: Page) =>
  (
    JSON.parse((await p.evaluate(() => localStorage.getItem('iron-squid:run'))) ?? '{}') as {
      state: RunState;
    }
  ).state;

// The brand icons of the set card's gear, in order, with what a screen reader is given for each.
async function cardIcons(p: Page, locale: string) {
  const set = p.getByRole('region', { name: messageIn(locale, 'set.label') });
  const icons = set.locator('.gear img.brand-icon');
  await expect(icons).toHaveCount(3);
  return icons.evaluateAll((imgs) =>
    imgs.map((i) => {
      const img = i as HTMLImageElement;
      return { src: new URL(img.src).pathname, alt: img.alt, loaded: img.naturalWidth > 0 };
    }),
  );
}

Then("the headgear, the clothing and the shoes each show their brand's icon", async ({ page }) => {
  const state = await stored(page);
  await expect.poll(async () => (await cardIcons(page, 'en-US')).every((i) => i.loaded)).toBe(true);
  expect((await cardIcons(page, 'en-US')).map((i) => i.src)).toEqual(
    brandsOf(state, state.cursor).map(iconSrc),
  );
  // Only the gear wears a brand: the kit has none.
  const set = page.getByRole('region', { name: messageIn('en-US', 'set.label') });
  await expect(set.locator('.piece-kit img.brand-icon')).toHaveCount(0);
});

When('the player reads the current set', async ({ page, world }) => {
  world.icons = await cardIcons(page, 'en-US');
});

Then("each gear piece's brand is read by its name", async ({ world }) => {
  const state = world.state as RunState;
  const english = namesIn('en-US');
  expect((world.icons as { alt: string }[]).map((i) => i.alt)).toEqual(
    brandsOf(state, state.cursor).map((b) => english[b]),
  );
});

Given(
  'a player on the {string} address with a set drawn',
  async ({ page, world }, address: string) => {
    const locale = address.replaceAll('/', '');
    const state = playRun(winsThenPlaying(2));
    world.state = state;
    world.locale = locale;
    await seedRun(page, state, locale);
  },
);

Then('each brand is named in Japanese', async ({ page, world }) => {
  const state = world.state as RunState;
  const japanese = namesIn('ja-JP');
  const english = namesIn('en-US');
  const alts = (await cardIcons(page, 'ja-JP')).map((i) => i.alt);
  const brands = brandsOf(state, state.cursor);
  expect(alts).toEqual(brands.map((b) => japanese[b]));
  // The Japanese names are the game's own, not the English ones passed through (amiibo is both).
  expect(brands.some((b) => japanese[b] !== english[b])).toBe(true);
});

When('a visitor opens a link to a run with conquered sets', async ({ page, world }) => {
  const state = playRun(winsThenPlaying(4));
  world.state = state;
  await page.goto(`./en-US/run/#${encodeShare(state, catalogue)}`);
});

Then("each conquered set's gear shows its brand's icon", async ({ page, world }) => {
  const state = world.state as RunState;
  const english = namesIn('en-US');
  const items = page
    .getByRole('list', { name: messageIn('en-US', 'shared.sets') })
    .getByRole('listitem');
  await expect(items).toHaveCount(state.conquered);
  for (let n = 0; n < state.conquered; n++) {
    const icons = await items
      .nth(n)
      .locator('img.brand-icon')
      .evaluateAll((imgs) =>
        imgs.map((i) => ({
          src: new URL((i as HTMLImageElement).src).pathname,
          alt: (i as HTMLImageElement).alt,
          loading: i.getAttribute('loading'),
        })),
      );
    const brands = brandsOf(state, n);
    expect(icons, `set ${n + 1}`).toEqual(
      brands.map((b) => ({ src: iconSrc(b), alt: english[b], loading: 'lazy' })),
    );
  }
  // On a phone every icon is on the screen: none pushed past its edge, where the page clips it.
  await page.setViewportSize({ width: 360, height: 800 });
  const outside = await items
    .locator('img.brand-icon')
    .evaluateAll(
      (imgs) => imgs.filter((i) => i.getBoundingClientRect().right > window.innerWidth).length,
    );
  expect(outside).toBe(0);
});
