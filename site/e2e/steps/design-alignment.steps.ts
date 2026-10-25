import { expect, type Page } from '@playwright/test';
import { Given, Then, When } from '../fixtures';
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
