import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import type { Catalogue } from '../../src/catalogue/types';
import type { RunState } from '../../src/run/engine';
import { encodeShare, packShare, widthsOf, type Packed } from '../../src/share/link';
import { Given, Then, When } from '../fixtures';
import { playRun, seedRun, setNames, winsThenPlaying } from '../support/seed';

const messages = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) => {
  const text = messages[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, 'en-US').format(values));
};
const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;

// Links are made the way the site makes them, from runs played through the engine.
const linkTo = (state: RunState) => `./en-US/run/#${encodeShare(state, catalogue)}`;
const packed = (patch: Partial<Packed>) =>
  `./en-US/run/#${packShare(
    {
      version: '11.3.0',
      name: new Uint8Array(),
      conquered: 2,
      lives: 1,
      resets: 0,
      sets: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
      ],
      ...patch,
    },
    widthsOf(catalogue),
  )}`;

const sets = (p: Page) =>
  p.getByRole('list', { name: message('shared.sets') }).getByRole('listitem');

async function open(p: Page, state: RunState) {
  await p.goto(linkTo(state));
  await expect(p.getByRole('heading', { level: 1 })).toBeVisible();
}

When(
  'a visitor opens a link to a run named {string} with {int} of {int} kits conquered',
  async ({ page, world }, name: string, conquered: number, total: number) => {
    const state = playRun([...winsThenPlaying(conquered), 'loss'], name);
    expect(state.order.kits).toHaveLength(total);
    world.state = state;
    await open(page, state);
  },
);

Then('the visitor sees the run named {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
});

Then('{int} of {int} kits conquered', async ({ page }, conquered: number, total: number) => {
  await expect(page.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered, total }),
  );
});

Then('the conquered sets, in the order they were conquered', async ({ page, world }) => {
  const state = world.state as RunState;
  const items = sets(page);
  await expect(items).toHaveCount(state.conquered);
  for (let n = 0; n < state.conquered; n++) {
    const [kit, head, clothes, shoes] = setNames(state, n);
    await expect(items.nth(n)).toContainText(
      message('shared.set', { number: n + 1, kit, head, clothes, shoes }),
    );
  }
  // 160 sets are 160 images: each loads only as it nears the screen (NFR-P1, failure 3).
  const loading = await items
    .locator('img')
    .evaluateAll((imgs) => imgs.map((i) => i.getAttribute('loading')));
  expect(loading).toHaveLength(state.conquered);
  expect(new Set(loading)).toEqual(new Set(['lazy']));
});

Then("the run's lives and resets", async ({ page, world }) => {
  const state = world.state as RunState;
  // Each number with its name, in the row under the headline (design-alignment).
  const stat = (id: string) =>
    page
      .locator('.shared-numbers > div')
      .filter({ has: page.getByText(message(id), { exact: true }) });
  await expect(stat('shared.statLives').locator('dd')).toHaveText(String(state.lives));
  await expect(stat('shared.statResets').locator('dd')).toHaveText(String(state.resets));
});

Then('whether the run is complete', async ({ page }) => {
  await expect(page.getByText(message('shared.inProgress'), { exact: true })).toBeVisible();
  await expect(page.getByText(message('shared.complete'), { exact: true })).toHaveCount(0);
});

When('a visitor opens a link to a run', async ({ page }) => {
  await open(page, playRun(winsThenPlaying(3)));
});

Then(
  'the visitor is not offered to report a result, undo or draw a set for it',
  async ({ page }) => {
    await expect(sets(page)).toHaveCount(3);
    for (const id of ['run.won', 'run.lost', 'run.undo', 'run.next', 'start.roll', 'run.newRun']) {
      await expect(page.getByRole('button', { name: message(id) }), id).toHaveCount(0);
    }
  },
);

Given('a visitor with a run of their own in progress', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(5), 'Own run'));
  await expect(page.locator('.run-title')).toHaveText('Own run');
  world.stored = await page.evaluate(() => localStorage.getItem('iron-squid:run'));
});

When("the visitor opens a link to someone else's run", async ({ page }) => {
  await open(page, playRun(winsThenPlaying(7), 'Someone else'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Someone else');
});

Then("the visitor's own run is unchanged", async ({ page, world }) => {
  // Byte for byte: not replaced, and not written again (failure 1).
  expect(await page.evaluate(() => localStorage.getItem('iron-squid:run'))).toBe(world.stored);
});

Then('the visitor is offered a way back to it', async ({ page }) => {
  await page.getByRole('link', { name: message('shared.backToRun') }).click();
  await expect(page.locator('.run-title')).toHaveText('Own run');
});

Given('a visitor with no run', async ({ page }) => {
  await page.goto('./en-US/');
  expect(await page.evaluate(() => localStorage.getItem('iron-squid:run'))).toBeNull();
});

Then('the visitor is offered to start a run of their own', async ({ page }) => {
  await page.getByRole('link', { name: message('shared.startOwn') }).click();
  await expect(page.getByRole('button', { name: message('start.roll') })).toBeVisible();
});

When(
  'a visitor opens a link to a run whose display name is {string}',
  async ({ page }, name: string) => {
    await open(page, playRun(winsThenPlaying(2), name));
  },
);

Then('the visitor sees the name exactly as {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.locator('main b')).toHaveCount(0);
});

When('a visitor opens a link whose run cannot be read', async ({ page }) => {
  await page.goto('./en-US/run/#this-is-not-a-run');
});

When('a visitor opens a link to a run in which a gear piece was used twice', async ({ page }) => {
  await page.goto(
    packed({
      sets: [
        [0, 0, 0, 0],
        [1, 0, 1, 1],
      ],
    }),
  );
});

Then('the visitor is told the link is broken', async ({ page }) => {
  await expect(page.getByRole('alert')).toHaveText(message('shared.broken'));
});

Then('no part of a run is shown', async ({ page }) => {
  await expect(page.locator('.ink-strip')).toHaveCount(0);
  await expect(page.getByRole('list', { name: message('shared.sets') })).toHaveCount(0);
  await expect(page.locator('main').getByRole('img')).toHaveCount(0);
});

When(
  'a visitor opens a link to a run on a catalogue version the site does not carry',
  async ({ page }) => {
    await page.goto(packed({ version: '9.9.9' }));
  },
);

Then('the visitor is told which catalogue version the run needs', async ({ page }) => {
  await expect(page.getByRole('alert')).toHaveText(
    message('shared.unknownCatalogue', { version: '9.9.9' }),
  );
});
