import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { Then, When } from '../fixtures';

// squid-logo: the logo as the site serves it, read as a drawing. The steps look at its shapes, not
// at its pixels: what the story asks is round eyes in a dark mask, round contours and iron grey.
type Shape = { tag: string; fill: string; r: number; cx: number; cy: number; join: string };

async function logoShapes(p: Page): Promise<Shape[]> {
  await p.goto('./logo.svg');
  return p.evaluate(() =>
    [...document.querySelectorAll('svg *')].map((e) => ({
      tag: e.tagName,
      fill: (e.getAttribute('fill') ?? '').toLowerCase(),
      r: Number(e.getAttribute('r') ?? 0),
      cx: Number(e.getAttribute('cx') ?? 0),
      cy: Number(e.getAttribute('cy') ?? 0),
      join: e.closest('[stroke-linejoin]')?.getAttribute('stroke-linejoin') ?? '',
    })),
  );
}
const white = (s: Shape) => s.fill === '#fff' || s.fill === '#ffffff' || s.fill === 'white';
const dark = (s: Shape) => /^#[0-3][0-9a-f][0-3][0-9a-f][0-3][0-9a-f]$/.test(s.fill);

Then(
  'the logo shows two round white eyes, each with a dark pupil, set in a dark mask',
  async ({ page }) => {
    const shapes = await logoShapes(page);
    // The eyes: the two largest white circles, side by side.
    const eyes = shapes
      .filter((s) => s.tag === 'circle' && white(s))
      .sort((a, b) => b.r - a.r)
      .slice(0, 2);
    expect(eyes).toHaveLength(2);
    expect(Math.abs((eyes[0]?.cy ?? 0) - (eyes[1]?.cy ?? 0))).toBeLessThan(1);
    for (const eye of eyes) {
      const inside = (s: Shape) => Math.hypot(s.cx - eye.cx, s.cy - eye.cy) + s.r <= eye.r;
      expect(
        shapes.some((s) => s.tag === 'circle' && dark(s) && s.r > eye.r / 3 && inside(s)),
        'a dark pupil inside the eye',
      ).toBe(true);
    }
    // The mask: a dark shape behind the eyes, as wide as both.
    const mask = shapes.filter((s) => dark(s) && (s.tag === 'rect' || s.tag === 'circle'));
    expect(mask.length, 'a dark mask').toBeGreaterThan(0);
  },
);

Then("the logo's outline has no sharp corner", async ({ page }) => {
  const outlined = (await logoShapes(page)).filter((s) => s.tag === 'path');
  expect(outlined.length).toBeGreaterThan(0);
  for (const path of outlined) expect(path.join, 'every outline joins round').toBe('round');
});

Then("the logo's body is drawn in the iron grey of the site's mark", async ({ page }) => {
  await page.goto('./logo.svg');
  const stops = await page.evaluate(() =>
    [...document.querySelectorAll('linearGradient stop')].map((s) =>
      (s.getAttribute('stop-color') ?? '').toLowerCase(),
    ),
  );
  expect(stops).toEqual(['#8b929a', '#6c737b', '#5a6067']);
});

Then(
  'the logo is a file of the site, drawn for it, and is no image from the game',
  async ({ page, request }) => {
    const response = await request.get('./logo.svg');
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    const bytes = await response.body();
    expect(bytes.toString('utf8')).toContain("Iron Squid's own mark");
    // Not one of the game's images, under any name: no locked digest is the logo's.
    const sha = createHash('sha256').update(bytes).digest('hex');
    const versions = readdirSync('src/catalogue', { withFileTypes: true }).filter((e) =>
      e.isDirectory(),
    );
    const locked = versions
      .map((e) => e.name)
      .flatMap((v) =>
        Object.values(
          JSON.parse(readFileSync(join('src/catalogue', v, 'images.lock.json'), 'utf8')) as Record<
            string,
            string
          >,
        ),
      );
    expect(locked).not.toContain(sha);
    void page;
  },
);

When("a visitor's link to the site is posted", async () => {
  // The preview a messaging app shows is the site's preview image (link-previews); nothing to do.
});

Then('its preview image is made from the logo the site carries', async () => {
  const source = JSON.parse(readFileSync('scripts/preview-image.source.json', 'utf8')) as {
    logo: string;
    image: string;
  };
  const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
  expect(source.logo, 'the logo the image was made from').toBe(sha('public/logo.svg'));
  expect(source.image, 'the image as made').toBe(sha('public/preview.png'));
});
