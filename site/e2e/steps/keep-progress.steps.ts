import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { Given, Then, When } from '../fixtures';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';

const catalogue = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) => {
  const text = catalogue[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, 'en-US').format(values));
};
const button = (p: Page, id: string) => p.getByRole('button', { name: message(id) });

async function readSet(p: Page): Promise<string[]> {
  const images = p.getByRole('region', { name: message('set.label') }).getByRole('img');
  await expect(images).toHaveCount(4);
  return images.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).alt));
}

// The run as the player sees it: the strip, the set and the log, after the run has loaded.
async function snapshot(p: Page) {
  const set = await readSet(p);
  const details = p.locator('details.run-log');
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open)))
    await details.locator('summary').click();
  return {
    set,
    strip: (await p.locator('.ink-strip').innerText()).trim(),
    log: await p
      .getByRole('list', { name: message('log.title') })
      .getByRole('listitem')
      .allInnerTexts(),
  };
}

async function exportFrom(p: Page): Promise<string> {
  const [download] = await Promise.all([
    p.waitForEvent('download'),
    button(p, 'run.export').click(),
  ]);
  const path = await download.path();
  return readFileSync(path, 'utf8');
}

async function importInto(p: Page, content: string) {
  await p.getByLabel(message('run.import')).setInputFiles({
    name: 'iron-squid-run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
}

Then('the run is exactly where it was', async ({ world }) => {
  expect(await readSet(world.page as Page)).toEqual(world.set);
});

When('the player exports the run', async ({ page, world }) => {
  world.file = await exportFrom(page);
});

Then('the player receives a file holding the run', async ({ world }) => {
  const file = JSON.parse(world.file as string);
  expect(file).toMatchObject({
    format: 'iron-squid-run',
    version: 1,
    run: { schema: 2, catalogueVersion: '11.3.0' },
  });
  expect(file.run.order.kits).toHaveLength(160);
});

Given('a file exported from a run in progress', async ({ page, world }) => {
  // A run with some history: wins, a life earned, a loss, so the log and the strip have something.
  await seedRun(page, playRun([...winsThenPlaying(11), 'loss'], 'Inkling Ivo'));
  world.before = await snapshot(page);
  world.file = await exportFrom(page);
});

When('a player with no run imports it on another device', async ({ browser, baseURL, world }) => {
  const other = await (await browser.newContext({ baseURL })).newPage();
  await other.goto('./en-US/');
  await expect(button(other, 'start.roll')).toBeVisible();
  await importInto(other, world.file as string);
  world.page = other;
});

Then('the run continues exactly where it was when exported', async ({ world }) => {
  expect(await snapshot(world.page as Page)).toEqual(world.before);
});

When('the player imports a file', async ({ page }) => {
  const other = playRun(winsThenPlaying(5));
  await importInto(
    page,
    JSON.stringify({ format: 'iron-squid-run', version: 1, exportedAt: '2026-10-25', run: other }),
  );
});

Then(
  'the player is asked to confirm, and told the current run will be replaced',
  async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(message('import.warning'));
  },
);

When('a player imports a file that is not a valid run', async ({ page, world }) => {
  await page.goto('./en-US/');
  await button(page, 'start.roll').click();
  world.set = await readSet(page);
  world.stored = await page.evaluate(() => localStorage.getItem('iron-squid:run'));
  await importInto(page, '{"hello": "not a run"}');
});

Then('the import is refused', async ({ page, world }) => {
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (world.stored !== undefined) {
    expect(await page.evaluate(() => localStorage.getItem('iron-squid:run'))).toBe(world.stored);
  }
});

Then('the player is told the file is not a valid Iron Squid run', async ({ page }) => {
  await expect(page.getByRole('alert')).toHaveText(message('import.notARun'));
});

When(
  'a player imports a run that names a catalogue version the site does not carry',
  async ({ page }) => {
    await page.goto('./en-US/');
    const run = { ...playRun(winsThenPlaying(2)), catalogueVersion: '9.9.9' };
    await importInto(
      page,
      JSON.stringify({ format: 'iron-squid-run', version: 1, exportedAt: '2026-10-25', run }),
    );
  },
);

Then('the player is told which catalogue version the file needs', async ({ page }) => {
  await expect(page.getByRole('alert')).toHaveText(
    message('import.unknownCatalogue', { version: '9.9.9' }),
  );
});

Given('a browser that does not let the site store anything', async ({ page, guard }) => {
  guard.storageBlocked = true;
  // The strictest refusal: reaching localStorage at all throws, as with blocked site data.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
});

When('the player opens the site', async ({ page }) => {
  await page.goto('./en-US/');
});

const notKept = (p: Page) => p.getByRole('alert').filter({ hasText: message('storage.notKept') });

Then('the player is told the run will not be kept when the page closes', async ({ page }) => {
  await expect(notKept(page)).toBeVisible();
});

Then('the player is offered to export it instead', async ({ page, browser, baseURL }) => {
  // There is a run to export once one is started; the notice stays, and carries the export.
  await button(page, 'start.roll').click();
  await expect(notKept(page)).toBeVisible();
  const before = await snapshot(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    notKept(page)
      .getByRole('button', { name: message('run.export') })
      .click(),
  ]);
  const file = readFileSync(await download.path(), 'utf8');
  // The file it gives works in a browser that does keep runs (failure 3).
  const other = await (await browser.newContext({ baseURL })).newPage();
  await other.goto('./en-US/');
  await importInto(other, file);
  expect(await snapshot(other)).toEqual(before);
});
