import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { Given, Then, When } from '../fixtures';
import { askForMode, modeName, report } from '../support/report';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';
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

// What the header strip and the set card say: the run as the player sees it.
// The set first: it is there only once the run has loaded, so the strip is read after loading.
async function snapshot(p: Page) {
  const set = await readSet(p);
  return { strip: (await p.locator('.ink-strip').innerText()).trim(), set };
}

Given(
  'a player playing a set with {int} life and {int} of {int} kits conquered',
  async ({ page, world }, lives: number, conquered: number, total: number) => {
    const state = playRun(winsThenPlaying(conquered));
    expect(state.lives).toBe(lives);
    expect(state.order.kits).toHaveLength(total);
    await seedRun(page, state);
    world.set = await readSet(page);
  },
);

Given(
  'a player with 1 life and {int} wins since the run started',
  async ({ page }, wins: number) => {
    const state = playRun(winsThenPlaying(wins));
    expect(state.lives).toBe(1);
    await seedRun(page, state);
  },
);

Given('a player with {int} wins since the run started', async ({ page }, wins: number) => {
  await seedRun(page, playRun(winsThenPlaying(wins)));
});

Given('a player playing a set with {int} lives', async ({ page, world }, lives: number) => {
  const state = playRun(winsThenPlaying(10 * (lives - 1)));
  expect(state.lives).toBe(lives);
  await seedRun(page, state);
  world.set = await readSet(page);
});

// Opens the choice of mode; the report is completed in Turf War before the next step, unless that
// step is about the choice (see BeforeStep in e2e/fixtures.ts).
When('the player reports a win', async ({ page, world }) => {
  await askForMode(page, 'win', { keyboard: world.keyboard === true });
  world.reportPending = 'win';
});

When('the player reports a loss', async ({ page, world }) => {
  await askForMode(page, 'loss');
  world.reportPending = 'loss';
});

// A win moves straight on to the next set (match-modes): what was conquered is the notice it leaves.
Then('the set is conquered', async ({ page }) => {
  await expect(page.locator('.just-conquered')).toBeVisible();
});

Then('the player has {int} lives', async ({ page }, lives: number) => {
  await expect(page.getByRole('list', { name: message('run.lives', { lives }) })).toBeVisible();
});

Then(
  'the player is shown that {int} more wins earn the next life',
  async ({ page }, wins: number) => {
    await expect(page.getByText(message('run.nextLife', { wins }), { exact: true })).toBeVisible();
  },
);

Then('the player is playing the same set again', async ({ page, world }) => {
  await expect(button(page, 'run.won')).toBeVisible();
  expect(await readSet(page)).toEqual(world.set);
});

Given(
  'a player with {int} lives has just reported a loss',
  async ({ page, world }, lives: number) => {
    await seedRun(page, playRun(winsThenPlaying(10 * (lives - 1))));
    world.before = await snapshot(page);
    await report(page, 'loss');
  },
);

When('the player undoes it', async ({ page }) => {
  await button(page, 'run.undo').click();
});

Then('the run is exactly as it was before the loss was reported', async ({ page, world }) => {
  expect(await snapshot(page)).toEqual(world.before);
});

Given('a player has just reported the win that earned a life', async ({ page }) => {
  await seedRun(page, playRun(winsThenPlaying(9)));
  await report(page, 'win');
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 2 }) })).toBeVisible();
});

Then('the set is no longer conquered', async ({ page }) => {
  await expect(button(page, 'run.won')).toBeVisible();
  await expect(page.getByText(message('set.playing'), { exact: true })).toBeVisible();
});

Then('the life it earned is gone', async ({ page }) => {
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 1 }) })).toBeVisible();
});

Given('a player has reported two results', async ({ page }) => {
  await seedRun(page, playRun(winsThenPlaying(10)));
  await report(page, 'loss');
  await report(page, 'win');
});

When('the player undoes the second', async ({ page }) => {
  await button(page, 'run.undo').click();
  await expect(button(page, 'run.won')).toBeVisible();
});

Then('the first result can no longer be undone', async ({ page }) => {
  await expect(button(page, 'run.undo')).toHaveCount(0);
});

Then('the player is shown how many kits are conquered out of the total', async ({ page }) => {
  await expect(
    page.getByText(message('run.conquered', { conquered: 0, total: 160 }), { exact: true }),
  ).toBeVisible();
});

Then('how many lives they have', async ({ page }) => {
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 1 }) })).toBeVisible();
});

Then('how many wins until the next life', async ({ page }) => {
  await expect(
    page.getByText(message('run.nextLife', { wins: 10 }), { exact: true }),
  ).toBeVisible();
});

Then('the current set', async ({ page }) => {
  expect((await readSet(page)).every((n) => n.length > 0)).toBe(true);
});

Then('how many resets the run has had', async ({ page }) => {
  await expect(page.getByText(message('run.resets', { resets: 0 }), { exact: true })).toBeVisible();
});

// A run with a few results already, so there is a log to read as well as a result to report.
Given('a player using a screen reader', async ({ page, world }) => {
  const state = playRun(winsThenPlaying(3));
  world.state = state;
  await seedRun(page, state);
  world.set = await readSet(page);
});

When('the player reports a result', async ({ page }) => {
  await report(page, 'win');
});

Then(
  'the screen reader announces the result and the lives the player now has',
  async ({ page, world }) => {
    const [kit] = world.set as string[];
    const expected = message('announce.win', {
      kit,
      mode: modeName('Pnt'),
      lives: message('run.lives', { lives: 1 }),
    });
    // The run's own announcement, which goes on to the next set (report-mode); the page has other
    // live regions (the share status).
    const live = page.locator('.run-announcement[aria-live="polite"]');
    await expect(live).toHaveText(
      new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `),
    );
    await expect(live).toHaveCount(1);
  },
);
