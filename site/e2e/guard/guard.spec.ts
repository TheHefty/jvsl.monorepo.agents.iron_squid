// The guard is what stops a scenario passing while the site breaks a rule, so it has to be seen
// failing. Each test here breaks one rule on a real page of the build and is marked test.fail():
// it passes only if the guard fails it. A guard that stopped biting turns these red.
import { test } from '../fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('./en-US/');
});

test('fails a scenario whose page asks another host for something', async ({ page }) => {
  test.fail();
  await page.route('https://example.com/**', (r) => r.fulfill({ status: 204 }));
  await page.evaluate(() => fetch('https://example.com/ping').catch(() => undefined));
});

test('fails a scenario whose page breaks the Content Security Policy', async ({ page }) => {
  test.fail();
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = 'main { color: red }';
    document.head.append(s);
  });
});

test('fails a scenario whose page asks the site for a file it does not have', async ({ page }) => {
  test.fail();
  await page.evaluate(() => fetch('./missing.js'));
});

test('fails a scenario that ends with an accessibility violation', async ({ page }) => {
  test.fail();
  await page.evaluate(() =>
    document.querySelector('main')?.append(document.createElement('button')),
  );
});
