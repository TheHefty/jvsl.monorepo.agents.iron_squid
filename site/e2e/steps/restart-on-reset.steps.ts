import { expect, type Page } from '@playwright/test';
import { currentSet, reroll, type RunState } from '../../src/run/engine';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { report } from '../support/report';
import { nameOf, playRun, seedRun, winsThenPlaying, type Play } from '../support/seed';

// reset-restart: losing the last life starts the run over from nothing, with a new draw. The steps
// drive the screen and read the run the page stored to know what it holds.
const message = (id: string, values: Record<string, unknown> = {}) =>
  messageIn('en-US', id, values);
const at = '2026-10-20T12:00:00.000Z';
const sorted = (xs: string[]) => [...xs].sort();

const stored = async (p: Page) =>
  (
    JSON.parse((await p.evaluate(() => localStorage.getItem('iron-squid:run'))) ?? '{}') as {
      state: RunState;
    }
  ).state;

// The wins earn a life every 10: losses on the next new draw spend them down to `lives`.
const toLives = (conquered: number, lives: number): Play[] => [
  ...winsThenPlaying(conquered),
  ...Array<Play>(Math.floor(conquered / 10) + 1 - lives).fill('loss'),
];

async function seed(p: Page, world: Record<string, unknown>, state: RunState) {
  world.state = state;
  await seedRun(p, state);
  await expect(p.locator('.run-title')).toBeVisible();
  return state;
}

Given(
  'a player with {int} conquered kits and {int} life in a new run',
  async ({ page, world }, conquered: number, lives: number) => {
    const state = await seed(page, world, playRun(toLives(conquered, lives)));
    expect(state).toMatchObject({ conquered, lives, resets: 0, resetRule: 'restart' });
  },
);

Then(
  "the run's order of kits is drawn again, from every kit in the game",
  async ({ page, world }) => {
    const before = world.state as RunState;
    const after = await stored(page);
    expect(after.resets).toBe(1);
    expect(sorted(after.order.kits)).toEqual(sorted(before.order.kits));
    // 1 in 160! that a fair draw gives the same order back.
    expect(after.order.kits).not.toEqual(before.order.kits);
  },
);

Then('the player is playing the first set of that new order, not a replay', async ({ page }) => {
  const s = await stored(page);
  expect(s.cursor).toBe(0);
  const set = page.getByRole('region', { name: message('set.label') });
  await expect(set.getByRole('img', { name: nameOf(s.order.kits[0]), exact: true })).toBeVisible();
  await expect(page.getByText(message('set.replay'), { exact: true })).toHaveCount(0);
  await expect(page.getByText(message('set.playing'), { exact: true })).toBeVisible();
});

Given(
  'a player who re-rolled away a piece and then lost the last life',
  async ({ page, world }) => {
    // A new run's first set, its shoes re-rolled, then lost on its only life.
    let s = playRun([]);
    s = reroll(s, { step: s.step, at, slot: 'shoes' });
    expect(s.spent.shoes).toBe(1);
    await seed(page, world, s);
    world.given = s.rerolls[0]?.from;
    await report(page, 'loss');
  },
);

When('the run has reset', async ({ page }) => {
  await expect(page.getByText(message('run.restartNotice'))).toBeVisible();
});

Then('every gear piece of the catalogue can be drawn again', async ({ page, world }) => {
  const s = await stored(page);
  const before = world.state as RunState;
  for (const slot of ['head', 'clothes', 'shoes'] as const) {
    expect(sorted(s.order[slot]), slot).toEqual(sorted(before.order[slot]));
    expect(s.worn[slot], slot).toEqual({});
  }
  // The piece re-rolled away is among the pieces the new order holds for the sets.
  expect(s.order.shoes).toContain(world.given);
});

Then('every spare is there again for a re-roll', async ({ page }) => {
  expect((await stored(page)).spent).toEqual({ head: 0, clothes: 0, shoes: 0 });
  for (const slot of ['head', 'clothes', 'shoes'] as const)
    await expect(
      page.getByRole('button', { name: message('reroll.label', { slot }) }),
    ).toBeVisible();
});

Given(
  'a player who has just lost the last life and seen the new first set',
  async ({ page, world }) => {
    await seed(page, world, playRun(toLives(3, 1)));
    await report(page, 'loss');
    world.first = currentSet(await stored(page));
  },
);

Then('the new first set is the same as before', async ({ page, world }) => {
  const s = await stored(page);
  expect(s.resets).toBe(1);
  expect(currentSet(s)).toEqual(world.first);
});

Then(
  'the run log still lists the {int} matches before the reset',
  async ({ page, world }, matches: number) => {
    const before = world.state as RunState;
    const details = page.locator('details.run-log');
    if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open)))
      await details.locator('summary').click();
    const items = page.getByRole('list', { name: message('log.title') }).getByRole('listitem');
    // The matches before, and the loss that reset the run: newest first.
    await expect(items).toHaveCount(matches + 1);
    const oldest = before.log[0];
    await expect(items.last()).toContainText(nameOf(oldest?.kit ?? before.order.kits[0]));
  },
);

Then('marks the loss that reset the run', async ({ page }) => {
  const items = page.getByRole('list', { name: message('log.title') }).getByRole('listitem');
  await expect(items.first()).toContainText(message('log.markLoss'));
  await expect(items.first()).toContainText('The run was reset.');
});

Given(
  'a player with {int} kits conquered since the last reset',
  async ({ page, world }, conquered: number) => {
    const state = await seed(
      page,
      world,
      playRun([...toLives(3, 1), 'loss', ...winsThenPlaying(conquered)]),
    );
    expect(state).toMatchObject({ resets: 1, conquered });
  },
);

Given(
  'a run that reset after {int} conquered kits and has won {int} since',
  async ({ page, world }, before: number, since: number) => {
    const state = await seed(
      page,
      world,
      playRun([...toLives(before, 1), 'loss', ...winsThenPlaying(since)]),
    );
    expect(state).toMatchObject({ resets: 1, conquered: since });
  },
);

Then(
  'the visitor sees {int} of {int} kits conquered, and those {int} sets',
  async ({ world }, conquered: number, total: number, sets: number) => {
    const other = world.other as Page;
    const state = world.state as RunState;
    await expect(other.locator('.run-conquered')).toHaveText(
      message('run.conquered', { conquered, total }),
    );
    const items = other.getByRole('list', { name: message('shared.sets') }).getByRole('listitem');
    await expect(items).toHaveCount(sets);
    for (let n = 0; n < sets; n++)
      await expect(items.nth(n)).toContainText(nameOf(state.order.kits[n]));
  },
);

Given(
  'a run begun under the reshuffled reset, with {int} conquered kits and {int} life',
  async ({ page, world }, conquered: number, lives: number) => {
    const state = await seed(
      page,
      world,
      playRun(toLives(conquered, lives), undefined, undefined, undefined, 'reshuffle'),
    );
    expect(state).toMatchObject({ conquered, lives, resetRule: 'reshuffle' });
  },
);

Then('the run starts over from nothing at each reset', async ({ page }) => {
  expect((await stored(page)).resetRule).toBe('restart');
});

Then('the run is complete', async ({ page }) => {
  await expect(page.getByRole('heading', { name: message('finish.title') })).toBeVisible();
  const s = await stored(page);
  expect(s).toMatchObject({ conquered: 160, resets: 1, phase: 'conquered' });
});
