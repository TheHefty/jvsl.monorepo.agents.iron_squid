// The site's root without its script (task root-language, failure 1): a browser with JavaScript
// turned off still reaches a page, through the refresh to the default locale.
//
// Outside the guard on purpose: the guard ends each test by running axe in the page, which is
// itself JavaScript and cannot run here. The root's accessibility is checked in static-pages.spec.
import { expect, test } from '@playwright/test';

test.describe('with JavaScript turned off', () => {
  test.use({ javaScriptEnabled: false });

  test('the root still sends the visitor to the default locale', async ({ page, baseURL }) => {
    await page.goto('./');
    await expect(page).toHaveURL(new URL('./en-US/', baseURL).href);
  });
});
