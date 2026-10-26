import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tempDir } from '../support/temp';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { Given, Then, When } from '../fixtures';
import { createPagesServer } from '../../scripts/pages-server';
import type { Catalogue, NamesFile } from '../../src/catalogue/types';
import { locales } from '../../src/i18n/locales';
import type { RunState } from '../../src/run/engine';
import { basePath } from '../site-under-test';
import { run } from '../support/run';
import { playRun, seedRun, seedRunScript, setNames, winsThenPlaying } from '../support/seed';
import { pieceImages } from '../support/set';

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
  const images = pieceImages(p);
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
    run: { schema: 3, catalogueVersion: '11.3.0' },
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

// A run on an older catalogue, and a site rebuilt with a newer one beside it (FR-33).
const added = 'Iron Squid Test Kit';

Given(
  'a player with a run started on catalogue version {word}',
  async ({ page, world }, version: string) => {
    const state = playRun(winsThenPlaying(3));
    expect(state.catalogueVersion).toBe(version);
    world.state = state;
    await seedRunScript(page, state);
  },
);

Given(
  'the site has since been rebuilt from a newer catalogue version',
  async ({ page, baseURL, $test }) => {
    // A whole build of the site, not one page: under load it once ran past the default 30 s and
    // failed a run for nothing, which on the release would hold the release.
    $test.setTimeout(120_000);
    // 11.3.0 as published, and an invented 12.0.0: the same data with one kit added, whose image is
    // one already locked, so the build fetches nothing new.
    const dir = tempDir('catalogue-');
    cpSync('src/catalogue/11.3.0', join(dir, '11.3.0'), { recursive: true });
    const newer = JSON.parse(
      readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
    ) as Catalogue;
    const [first] = newer.kits;
    if (!first) throw new Error('steps: the 11.3.0 catalogue has no kits');
    newer.version = '12.0.0';
    newer.kits.push({ id: 'Test_Added_00', image: first.image });
    mkdirSync(join(dir, newer.version, 'names'), { recursive: true });
    // Every locale names the added kit, as a generated catalogue would.
    for (const locale of locales) {
      const file = JSON.parse(
        readFileSync(`src/catalogue/11.3.0/names/${locale}.json`, 'utf8'),
      ) as NamesFile;
      file.names['Test_Added_00'] = added;
      writeFileSync(join(dir, newer.version, 'names', `${locale}.json`), JSON.stringify(file));
    }
    writeFileSync(join(dir, newer.version, 'catalogue.json'), JSON.stringify(newer));
    cpSync('src/catalogue/11.3.0/images.lock.json', join(dir, newer.version, 'images.lock.json'));
    const out = tempDir('build-');
    // The site's own public files (its logo), without the game images the build places there.
    const publicDir = tempDir('public-');
    cpSync('public', publicDir, {
      recursive: true,
      filter: (src) => !/\/public\/game(\/|$)/.test(src),
    });
    const built = await run('npm', ['run', 'build'], {
      CATALOGUE_DIR: dir,
      PUBLIC_DIR: publicDir,
      BUILD_OUT_DIR: out,
    });
    expect(built.status, built.output).toBe(0);

    // Served at the address under test, so the guard and the CSP apply to it as to any page.
    const server = createPagesServer({ root: out, basePath });
    await new Promise<void>((r) => server.listen(0, r));
    page.context().on('close', () => server.close());
    const port = (server.address() as AddressInfo).port;
    const origin = new URL(baseURL ?? '').origin;
    await page.route(
      (url) => url.origin === origin,
      async (route) => {
        const url = new URL(route.request().url());
        url.host = `localhost:${port}`;
        await route.fulfill({ response: await route.fetch({ url: url.href, maxRedirects: 0 }) });
      },
    );
  },
);

Then(
  'the run continues against catalogue version {word}',
  async ({ page, world }, version: string) => {
    const state = world.state as RunState;
    // The rebuilt site is the one answering, and the run is still drawn from its own catalogue.
    await expect(page.getByRole('contentinfo')).toContainText(
      message('catalogue.version', { version: '12.0.0' }),
    );
    expect(await readSet(page)).toEqual(setNames(state, state.cursor));
    const sources = await page
      .getByRole('region', { name: message('set.label') })
      .getByRole('img')
      .evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).getAttribute('src') ?? ''));
    for (const src of sources) expect(src).toContain(`/game/${version}/`);
  },
);

Then('the player is told the run is on an older catalogue', async ({ page }) => {
  await expect(
    page.getByText(message('run.olderCatalogue', { version: '11.3.0', newest: '12.0.0' })),
  ).toBeVisible();
});

Then('kits added since are not part of the run', async ({ page, world }) => {
  const state = world.state as RunState;
  await expect(page.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: state.conquered, total: 160 }),
  );
  await expect(page.getByText(added)).toHaveCount(0);
});
