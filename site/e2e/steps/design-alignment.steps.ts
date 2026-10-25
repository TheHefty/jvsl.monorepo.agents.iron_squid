import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import type { RunState } from '../../src/run/engine';
import { encodeShare } from '../../src/share/link';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';

// The angle a transform turns or skews by, in degrees, from its computed matrix.
type Drawn = { rotate: number; skew: number };
function angles(transform: string): Drawn {
  if (transform === 'none') return { rotate: 0, skew: 0 };
  // Computed transforms come back as matrix(a, b, c, d, e, f).
  const [a = 1, b = 0, c = 0, d = 1] = (/matrix\(([^)]*)\)/.exec(transform)?.[1] ?? '')
    .split(',')
    .map(Number);
  const rotate = (Math.atan2(b, a) * 180) / Math.PI;
  const skew = (Math.atan2(a * c + b * d, a * d - b * c) * 180) / Math.PI;
  return { rotate, skew };
}
// Computed in the page: transforms are read where they are drawn.
const transformsOf = (p: Page, selector: string, pseudo?: string) =>
  p.locator(selector).evaluateAll(
    // Only what is drawn: a closed dialog's buttons have no layout, and no transform to read.
    (els, ps) =>
      els
        .filter((el) => el.checkVisibility())
        .map((el) => getComputedStyle(el, ps ?? undefined).transform),
    pseudo,
  );

Then(
  'the stickers, tags and log marks on the run page are each rotated a few degrees',
  async ({ page, world }) => {
    const drawn = (await transformsOf(page, 'main .sticker, main .tag, main .log-mark')).map(
      (t) => angles(t).rotate,
    );
    expect(drawn.length, 'stickers and tags on the page').toBeGreaterThan(2);
    for (const r of drawn) {
      expect(Math.abs(r), `${r.toFixed(2)}deg`).toBeGreaterThanOrEqual(0.5);
      expect(Math.abs(r), `${r.toFixed(2)}deg`).toBeLessThanOrEqual(4);
    }
    world.tilts = drawn;
  },
);

Then('neighbouring stickers lean in different directions', async ({ page }) => {
  // The labels of one set, in the order they stand: each leans the other way from the one before.
  const tilts = (await transformsOf(page, '.set-card .tag')).map((t) => angles(t).rotate);
  expect(tilts.length).toBeGreaterThan(2);
  for (let i = 1; i < tilts.length; i++)
    expect(Math.sign(tilts[i] ?? 0), `tags ${i} and ${i + 1}`).not.toBe(
      Math.sign(tilts[i - 1] ?? 0),
    );
});

Then('every button on the run page is skewed', async ({ page }) => {
  const skews = (await transformsOf(page, 'main .btn', '::before')).map((t) => angles(t).skew);
  expect(skews.length, 'buttons on the run page').toBeGreaterThan(2);
  for (const s of skews) expect(Math.abs(s), `${s.toFixed(2)}deg`).toBeGreaterThanOrEqual(6);
});

Then('the text inside each button stands upright', async ({ page }) => {
  for (const t of await transformsOf(page, 'main .btn')) {
    const { rotate, skew } = angles(t);
    expect(Math.abs(rotate) + Math.abs(skew), 'the button itself is not turned').toBeLessThan(0.01);
  }
});

Then('the current set sits in a panel with one corner cut at an angle', async ({ page }) => {
  const cut = await page
    .locator('.set-card')
    .evaluate((el) => getComputedStyle(el, '::before').clipPath);
  // One corner cut: five points, a polygon with a diagonal at a corner.
  expect(cut).toMatch(/^polygon\(/);
  expect(cut.split(',').length, cut).toBe(5);
  // And on a layer, never on the panel itself, which would clip focus rings (failure 1).
  expect(await page.locator('.set-card').evaluate((el) => getComputedStyle(el).clipPath)).toBe(
    'none',
  );
});

Then('no paragraph of text is rotated', async ({ world }) => {
  expect(world.turned ?? []).toEqual([]);
});

When('the visitor moves focus through every control of the run page', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(3), 'Ivo'));
  const clipped: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const found = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const ring = getComputedStyle(el);
      const pad = parseFloat(ring.outlineWidth) + parseFloat(ring.outlineOffset);
      const box = { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
      // A ring is cut by an ancestor that clips: clip-path, or overflow that hides what passes it.
      for (let a = el.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.clipPath !== 'none') return `${el.outerHTML.slice(0, 60)} under a clip-path`;
        if (s.overflow !== 'visible' && a !== document.body && a !== document.documentElement) {
          const ar = a.getBoundingClientRect();
          if (box.l < ar.left || box.t < ar.top || box.r > ar.right || box.b > ar.bottom)
            return `${el.outerHTML.slice(0, 60)} cut by overflow`;
        }
      }
      return '';
    });
    if (found) clipped.push(found);
  }
  world.clipped = clipped;
});

Then(
  'the focus ring of each control is fully visible, including next to a cut corner',
  async ({ world }) => {
    expect(world.clipped).toEqual([]);
  },
);

Given('a phone screen {int} pixels wide', async ({ page, world }, width: number) => {
  await page.setViewportSize({ width, height: 740 });
  world.width = width;
});

When('a player plays a set', async ({ page }) => {
  await seedRun(page, playRun(winsThenPlaying(5), 'Inkling Ivo'));
  await page.locator('details.run-log summary').click();
});

Then('nothing on the page needs scrolling sideways', async ({ page, world }) => {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    world.width as number,
  );
});

When('a visitor opens the home page', async ({ page }) => {
  await page.goto('./en-US/');
  await expect(page.locator('.ink-strip')).toBeVisible();
});

When('the visitor opens the home page', async ({ page }) => {
  await page.goto('./en-US/');
  await expect(page.locator('.ink-strip')).toBeVisible();
});

Then('the ink strip at the top carries several splats', async ({ page }) => {
  // Shapes of their own, decorative: hidden from screen readers.
  const splats = page.locator('.ink-strip .splat');
  expect(await splats.count()).toBeGreaterThanOrEqual(3);
  for (const hidden of await splats.evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-hidden')),
  ))
    expect(hidden).toBe('true');
});

Then('its lower edge is slanted', async ({ page }) => {
  const clip = await page.locator('.ink-strip').evaluate((el) => getComputedStyle(el).clipPath);
  // A polygon whose two bottom corners stand at different heights.
  const points = (/polygon\((.*)\)/.exec(clip)?.[1] ?? '').split(',').map((p) => p.trim());
  expect(points.length, clip).toBe(4);
  expect(points[2]?.split(' ')[1]).not.toBe(points[3]?.split(' ')[1]);
});

Then("the kit's name is in uppercase display type", async ({ page }) => {
  const style = await page.locator('.piece-kit .piece-name').evaluate((el) => {
    const s = getComputedStyle(el);
    const body = parseFloat(getComputedStyle(document.body).fontSize);
    return {
      transform: s.textTransform,
      size: parseFloat(s.fontSize) / body,
      weight: Number(s.fontWeight),
    };
  });
  expect(style.transform).toBe('uppercase');
  expect(style.size, 'times the body text').toBeGreaterThanOrEqual(1.5);
  expect(style.weight).toBeGreaterThanOrEqual(500);
});

Then("the challenge's rules are shown as tilted stickers, in two columns", async ({ page }) => {
  const rules = page.locator('.rules li');
  await expect(rules).toHaveCount(5);
  const columns = await page
    .locator('.rules ol')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  const tilts = (await transformsOf(page, '.rules li .sticker')).map((t) => angles(t).rotate);
  expect(tilts).toHaveLength(5);
  for (const r of tilts) expect(Math.abs(r)).toBeGreaterThanOrEqual(0.5);
});

Given('a run with a win and a loss', async ({ page }) => {
  await seedRun(page, playRun([...winsThenPlaying(1), 'loss']));
});

Then('the win is marked with an ink blot and the loss with an outlined mark', async ({ page }) => {
  const marks = await page.locator('.run-log li .log-mark').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { fill: s.backgroundColor, line: parseFloat(s.borderTopWidth) };
    }),
  );
  // Newest first: the loss, then the win.
  const [loss, win] = marks;
  expect(win?.fill).not.toBe('rgba(0, 0, 0, 0)');
  expect(loss?.fill).toBe('rgba(0, 0, 0, 0)');
  expect(loss?.line).toBeGreaterThan(0);
});

Then('each mark says in words whether it was a win or a loss', async ({ page }) => {
  await expect(page.locator('.run-log li .log-mark')).toHaveText([
    messageIn('en-US', 'log.markLoss'),
    messageIn('en-US', 'log.markWin'),
  ]);
});

Given('a device that asks for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

When('a player is given a new set', async ({ page }) => {
  await seedRun(page, playRun(winsThenPlaying(1)));
  await page.getByRole('button', { name: messageIn('en-US', 'run.won') }).click();
  await page.getByRole('button', { name: messageIn('en-US', 'run.next') }).click();
});

Then("the kit's splat does not move", async ({ page }) => {
  const splat = page.locator('.kit-splat');
  await expect(splat).toBeVisible();
  // No animation is set at all: whether one is running at this instant depends on timing, since
  // a landing lasts under half a second.
  expect(await splat.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await splat.evaluate((el) => el.getAnimations().length)).toBe(0);
});

When(
  'a visitor opens a link to a run with {int} kits conquered',
  async ({ page, world }, conquered: number) => {
    const catalogue = JSON.parse(
      readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
    ) as Catalogue;
    const state = playRun(winsThenPlaying(conquered), 'Inkling Ivo');
    world.state = state;
    await page.goto(`./en-US/run/#${encodeShare(state, catalogue)}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inkling Ivo');
  },
);

Then('the page leads with a headline about the run', async ({ page, world }) => {
  const state = world.state as RunState;
  const headline = page.locator('.ink-strip .shared-headline');
  await expect(headline).toHaveText(
    messageIn('en-US', 'run.conquered', { conquered: state.conquered, total: 160 }),
  );
  // In display type, right under the run's name, before anything else of the run.
  const size = await headline.evaluate(
    (el) =>
      parseFloat(getComputedStyle(el).fontSize) /
      parseFloat(getComputedStyle(document.body).fontSize),
  );
  expect(size).toBeGreaterThanOrEqual(1.5);
  expect(
    await page
      .locator('.ink-strip h1')
      .evaluate((h) => h.nextElementSibling?.classList.contains('shared-headline')),
  ).toBe(true);
});

Then(
  'its kits conquered, kits to go, lives and resets stand in one row',
  async ({ page, world }) => {
    const state = world.state as RunState;
    const terms = page.locator('.shared-numbers dt');
    await expect(terms).toHaveText(
      ['shared.statConquered', 'shared.statToGo', 'shared.statLives', 'shared.statResets'].map(
        (id) => messageIn('en-US', id),
      ),
    );
    await expect(page.locator('.shared-numbers dd')).toHaveText(
      [state.conquered, 160 - state.conquered, state.lives, state.resets].map(String),
    );
    // One row: every number at the same height.
    const tops = await page
      .locator('.shared-numbers > div')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size, `tops ${tops.join(', ')}`).toBe(1);
  },
);
