import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import type { RunState } from '../../src/run/engine';
import { Given, Then, When, type World } from '../fixtures';
import { playRun, seedRun, setNames, winsThenPlaying, type Play } from '../support/seed';

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

// 12 conquered sets; the 12 wins earned a second life, so a loss leaves 1 and a second one resets.
const twelveThenReset: Play[] = [...winsThenPlaying(12), 'loss', 'loss'];

async function seed(page: Page, world: World, plays: Play[]) {
  const state = playRun(plays);
  world.state = state;
  await seedRun(page, state);
  await readSet(page);
  return state;
}
const seeded = (world: World) => world.state as RunState;

Given(
  'a player with {int} conquered sets and {int} life',
  async ({ page, world }, conquered: number, lives: number) => {
    const state = await seed(page, world, [...winsThenPlaying(conquered), 'loss']);
    expect(state).toMatchObject({ conquered, lives, resets: 0 });
  },
);

Then('the run has reset', async ({ page }) => {
  await expect(page.getByText(message('run.resetNotice'))).toBeVisible();
});

Then(
  'the player is playing the first set they conquered, with the same gear',
  async ({ page, world }) => {
    expect(await readSet(page)).toEqual(setNames(seeded(world), 0));
  },
);

Then('the run shows {int} reset(s)', async ({ page }, resets: number) => {
  await expect(page.getByText(message('run.resets', { resets }), { exact: true })).toBeVisible();
});

Given('a player replaying after a reset', async ({ page, world }) => {
  await seed(page, world, [...winsThenPlaying(3), 'loss']);
});

When('the player wins with the first conquered set', async ({ page }) => {
  await button(page, 'run.won').click();
  await button(page, 'run.next').click();
});

Then(
  'the player is playing the second conquered set, with the same gear',
  async ({ page, world }) => {
    expect(await readSet(page)).toEqual(setNames(seeded(world), 1));
  },
);

Given(
  'a player replaying after a reset, with {int} conquered sets',
  async ({ page, world }, conquered: number) => {
    const state = await seed(page, world, twelveThenReset);
    expect(state).toMatchObject({ conquered, cursor: 0, resets: 1 });
  },
);

When('the player is playing the fifth of them', async ({ page }) => {
  for (let i = 0; i < 4; i++) {
    await button(page, 'run.won').click();
    await button(page, 'run.next').click();
  }
  await expect(
    page.getByText(message('set.weaponNumber', { number: 5, total: 160 })),
  ).toBeVisible();
});

Then('the player is shown that this set is a replay', async ({ page }) => {
  await expect(page.getByText(message('set.replay'), { exact: true })).toBeVisible();
});

Then('that {int} replays remain before new draws', async ({ page }, remaining: number) => {
  await expect(
    page.getByText(message('set.replaysRemaining', { remaining }), { exact: true }),
  ).toBeVisible();
});

Given(
  'a player replaying after a reset, with {int} wins since the reset',
  async ({ page, world }, wins: number) => {
    const state = await seed(page, world, [...twelveThenReset, ...winsThenPlaying(wins)]);
    expect(state).toMatchObject({ winsSinceReset: wins, lives: 1 });
    expect(state.cursor).toBeLessThan(state.conquered);
  },
);

Given(
  'a player replaying after a reset, with {int} lives',
  async ({ page, world }, lives: number) => {
    const state = await seed(page, world, [
      ...twelveThenReset,
      ...winsThenPlaying(10 * (lives - 1)),
    ]);
    expect(state.lives).toBe(lives);
    expect(state.cursor).toBeLessThan(state.conquered);
    world.set = setNames(state, state.cursor);
  },
);

Then('the player is playing the same replayed set again', async ({ page, world }) => {
  expect(await readSet(page)).toEqual(world.set);
  await expect(page.getByText(message('set.replay'), { exact: true })).toBeVisible();
});

Given(
  'a player replaying the seventh of {int} conquered sets, with 1 life',
  async ({ page, world }, conquered: number) => {
    const state = await seed(page, world, [...twelveThenReset, ...winsThenPlaying(6)]);
    expect(state).toMatchObject({ conquered, cursor: 6, lives: 1 });
  },
);

Then('the player is playing the first conquered set again', async ({ page, world }) => {
  expect(await readSet(page)).toEqual(setNames(seeded(world), 0));
});

Then('the run shows one more reset', async ({ page, world }) => {
  await expect(
    page.getByText(message('run.resets', { resets: seeded(world).resets + 1 }), { exact: true }),
  ).toBeVisible();
});

Given(
  'a player replaying the last of {int} conquered sets',
  async ({ page, world }, conquered: number) => {
    const state = await seed(page, world, [...twelveThenReset, ...winsThenPlaying(conquered - 1)]);
    expect(state).toMatchObject({ conquered, cursor: conquered - 1 });
  },
);

Then(
  'the player is given a set that is not one of the {int}',
  async ({ page, world }, conquered: number) => {
    const set = await readSet(page);
    const earlier = Array.from({ length: conquered }, (_, n) => setNames(seeded(world), n));
    expect(earlier.map((s) => s[0])).not.toContain(set[0]);
    // For the step shared with draw-a-set: the set now, and every set drawn before it.
    world.set = set;
    world.seen = earlier;
    await expect(page.getByText(message('set.playing'), { exact: true })).toBeVisible();
  },
);

Given('a player with no conquered sets and 1 life', async ({ page, world }) => {
  await seed(page, world, []);
});

Then('the player is playing the same set again, with 1 life', async ({ page, world }) => {
  expect(await readSet(page)).toEqual(setNames(seeded(world), 0));
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 1 }) })).toBeVisible();
});

Given('a player whose last loss reset the run', async ({ page, world }) => {
  const state = await seed(page, world, winsThenPlaying(3));
  world.lostWith = setNames(state, state.cursor);
  await button(page, 'run.lost').click();
  await expect(page.getByText(message('run.resetNotice'))).toBeVisible();
});

Then('the player is playing the set they lost with, with 1 life', async ({ page, world }) => {
  expect(await readSet(page)).toEqual(world.lostWith);
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 1 }) })).toBeVisible();
});

Then('the run shows the resets it had before that loss', async ({ page, world }) => {
  await expect(
    page.getByText(message('run.resets', { resets: seeded(world).resets }), { exact: true }),
  ).toBeVisible();
});
