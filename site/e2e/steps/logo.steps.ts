import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures';
import { localeOfPage, messageIn } from '../support/messages';
import { pagesOfBuild, timeForEveryPage } from '../support/pages';

type Page_ = { path: string; html: string; app: boolean };

When('a visitor opens any page of the site', async ({ request, baseURL, guard, world, $test }) => {
  $test.setTimeout(timeForEveryPage());
  const pages: Page_[] = [];
  for (const path of pagesOfBuild()) {
    const url = new URL(path, baseURL);
    if (path === '404.html') guard.expectedMissing.add(url.pathname);
    const html = await (await request.get(url.href)).text();
    pages.push({ path, html, app: html.includes('<script type="module"') });
  }
  world.pages = pages;
});

Then("the browser tab shows Iron Squid's icon", async ({ world }) => {
  for (const p of world.pages as Page_[]) {
    expect(p.html, `${p.path || 'the root'} names an icon`).toMatch(
      /<link rel="icon" type="image\/svg\+xml" href="[^"]*logo\.svg"/,
    );
  }
});

Then('the icon is served by the site itself', async ({ world, request, baseURL }) => {
  const origin = new URL(baseURL ?? '').origin;
  for (const p of world.pages as Page_[]) {
    const href = /<link rel="icon"[^>]* href="([^"]+)"/.exec(p.html)?.[1] ?? '';
    const url = new URL(href, new URL(p.path, baseURL));
    expect(url.origin, `${p.path || 'the root'}'s icon`).toBe(origin);
    const response = await request.get(url.href);
    expect(response.status(), url.href).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  }
});

Then("the header shows Iron Squid's logo beside its name", async ({ page, world, baseURL }) => {
  // The pages with the app; the root only sends the visitor on, and has no header.
  for (const p of (world.pages as Page_[]).filter((q) => q.app && q.path !== '404.html')) {
    await page.goto(new URL(p.path, baseURL).href);
    const mark = page.getByRole('banner').locator('.site-mark');
    await expect(mark.locator('img')).toHaveAttribute('src', /logo[^/]*\.svg$/);
    await expect(mark).toContainText(messageIn(localeOfPage(p.path), 'site.name'));
  }
});

Given('a visitor on the privacy notice in {string}', async ({ page }, address: string) => {
  await page.goto(`.${address}privacy/`);
  await expect(page.getByRole('contentinfo')).toBeVisible();
});

When('the visitor activates the logo', async ({ page }) => {
  await page.getByRole('banner').locator('.site-mark').click();
});

Then('the visitor is on the home page, in the same language', async ({ page, baseURL }) => {
  await expect(page).toHaveURL(new URL('./pt-BR/', baseURL).href);
});

Given('a visitor using a screen reader', async ({ page }) => {
  await page.goto('./en-US/');
});

When('the visitor reaches the logo', async ({ page }) => {
  await page.getByRole('banner').locator('.site-mark').focus();
});

Then('it is read as {string}', async ({ page }, name: string) => {
  const focused = page.locator(':focus');
  await expect(focused).toHaveAccessibleName(name);
  expect(messageIn('en-US', 'header.home')).toBe(name);
});

// WCAG relative luminance and contrast of an sRGB hex colour.
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

Then('the icon has a contrast of at least 3:1 against white and against black', async () => {
  // The silhouette is painted with the iron gradient: every one of its stops must stand out on
  // both a light and a dark tab bar.
  const svg = readFileSync('public/logo.svg', 'utf8');
  const stops = [...svg.matchAll(/<stop [^>]*stop-color="(#[0-9a-f]{6})"/gi)].map(
    (m) => m[1] ?? '',
  );
  expect(stops.length, 'the gradient stops of the silhouette').toBeGreaterThan(1);
  expect(svg).toMatch(/fill="url\(#iron\)"/);
  for (const stop of stops) {
    expect(contrast(luminance(stop), 1), `${stop} against white`).toBeGreaterThanOrEqual(3);
    expect(contrast(luminance(stop), 0), `${stop} against black`).toBeGreaterThanOrEqual(3);
  }
});
