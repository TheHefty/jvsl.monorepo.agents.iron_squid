import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Catalogue, GearSlot, NamesFile } from '../../src/catalogue/types';
import {
  currentSet,
  gearOf,
  isReplay,
  reportLoss,
  reportWin,
  type CurrentSet,
  type RunState,
} from '../../src/run/engine';
import { cryptoSource } from '../../src/run/random';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { report } from '../support/report';
import { playRun, seedRun, setNames, winsThenPlaying, type Play } from '../support/seed';

// reset-reshuffle: each reset replays the conquered kits in a new order, with their gear dealt out
// again. The steps drive the screen; they read the run the page stored to know which pieces it shows.
const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const english = (
  JSON.parse(readFileSync('src/catalogue/11.3.0/names/en-US.json', 'utf8')) as NamesFile
).names;
void catalogue;
const message = (id: string, values: Record<string, unknown> = {}) =>
  messageIn('en-US', id, values);
const slots: GearSlot[] = ['head', 'clothes', 'shoes'];
const at = '2026-10-26T12:00:00.000Z';
const sorted = (xs: string[]) => [...xs].sort();

const stored = async (p: Page) =>
  (
    JSON.parse((await p.evaluate(() => localStorage.getItem('iron-squid:run'))) ?? '{}') as {
      state: RunState;
    }
  ).state;
// The set on screen, by its kit's name, as the player reads it.
async function onScreen(p: Page) {
  const s = await stored(p);
  const set = currentSet(s);
  await expect(
    p
      .getByRole('region', { name: message('set.label') })
      .getByRole('img', { name: english[set.kit], exact: true }),
  ).toBeVisible();
  return set;
}
// Wins every replay on screen, in turn, and returns the sets they were.
async function winReplays(p: Page): Promise<CurrentSet[]> {
  const sets: CurrentSet[] = [];
  while (isReplay(await stored(p))) {
    sets.push(await onScreen(p));
    await report(p, 'win');
  }
  return sets;
}
// The gear each conquered kit was won with: its first conquest, before any reset.
const conquests = (s: RunState) => Array.from({ length: s.conquered }, (_, n) => gearOf(s, n));
// The replays a reset drew, as sets, from the stored run (without playing them).
function drawnReplays(s: RunState, reset: number): CurrentSet[] {
  const r = s.replays[reset];
  if (!r) throw new Error(`steps: the run has no replays for reset ${reset}`);
  return r.draws.map((draw, i) => ({
    kit: s.order.kits[draw] ?? '',
    head: s.order.head[r.gear.head[i] ?? -1] ?? '',
    clothes: s.order.clothes[r.gear.clothes[i] ?? -1] ?? '',
    shoes: s.order.shoes[r.gear.shoes[i] ?? -1] ?? '',
  }));
}

async function seed(p: Page, world: Record<string, unknown>, plays: Play[]) {
  const state = playRun(plays);
  world.state = state;
  await seedRun(p, state);
  await onScreen(p);
  return state;
}

Given(
  'a player with {int} conquered kits and {int} life',
  async ({ page, world }, conquered: number, lives: number) => {
    // The wins earned more lives than one: losses spend them on the next new draw.
    const extra = Math.floor(conquered / 10);
    const state = await seed(page, world, [
      ...winsThenPlaying(conquered),
      ...Array<Play>(extra).fill('loss'),
    ]);
    expect(state).toMatchObject({ conquered, lives, resets: 0, resetRule: 'reshuffle' });
    world.next = currentSet(state);
  },
);

Then('the player replays the same {int} kits', async ({ page, world }, kits: number) => {
  const before = world.state as RunState;
  const sets = await winReplays(page);
  world.replays = sets;
  expect(sets).toHaveLength(kits);
  expect(sorted(sets.map((s) => s.kit))).toEqual(sorted(before.order.kits.slice(0, kits)));
});

Then('in an order drawn for this reset', async ({ world }) => {
  const before = world.state as RunState;
  const sets = world.replays as CurrentSet[];
  // 1 in 12! that a fair draw gives back the order of conquest.
  expect(sets.map((s) => s.kit)).not.toEqual(before.order.kits.slice(0, sets.length));
});

Then(
  'the replays wear exactly the headgear, clothing and shoes the {int} kits were won with',
  async ({ page, world }, kits: number) => {
    const before = world.state as RunState;
    const sets = (world.replays as CurrentSet[] | undefined) ?? (await winReplays(page));
    world.replays = sets;
    expect(sets).toHaveLength(kits);
    const won = conquests(before);
    for (const slot of slots)
      expect(sorted(sets.map((s) => s[slot])), slot).toEqual(sorted(won.map((w) => w[slot])));
  },
);

Then('not every kit wears the gear it was won with', async ({ world }) => {
  const won = conquests(world.state as RunState);
  const own = (world.replays as CurrentSet[]).filter((s) => {
    const w = won.find((x) => x.kit === s.kit);
    return w && slots.every((slot) => w[slot] === s[slot]);
  });
  expect(own.length).toBeLessThan(won.length);
});

When('the player reports a loss and wins every replay', async ({ page }) => {
  await report(page, 'loss');
  await expect(page.getByText(message('run.resetNotice'))).toBeVisible();
  await winReplays(page);
});

Then(
  'the first new draw after the replays is the one that was next before the reset',
  async ({ page, world }) => {
    expect(await onScreen(page)).toEqual(world.next);
    await expect(page.getByText(message('set.playing'), { exact: true })).toBeVisible();
  },
);

Given('a player who has reset once and replayed every conquered kit', async ({ page, world }) => {
  // 12 wins (2 lives), two losses to reset, the 12 replays won (2 lives again).
  const state = await seed(page, world, [
    ...winsThenPlaying(12),
    'loss',
    'loss',
    ...winsThenPlaying(12),
  ]);
  expect(state).toMatchObject({ resets: 1, cursor: 12, conquered: 12 });
});

When('the player loses the last life again', async ({ page }) => {
  while ((await stored(page)).resets < 2) await report(page, 'loss');
});

Then('the replays come in a new order, with the gear dealt out again', async ({ page }) => {
  const s = await stored(page);
  const first = drawnReplays(s, 1);
  const second = drawnReplays(s, 2);
  expect(second.map((x) => x.kit)).not.toEqual(first.map((x) => x.kit));
  for (const slot of slots)
    expect(sorted(second.map((x) => x[slot])), slot).toEqual(sorted(first.map((x) => x[slot])));
  expect(await onScreen(page)).toEqual(second[0]);
});

Given(
  'a player who has just lost the last life and seen the first replay',
  async ({ page, world }) => {
    await seed(page, world, [...winsThenPlaying(12), 'loss']);
    await report(page, 'loss');
    world.first = await onScreen(page);
    world.replaysDrawn = (await stored(page)).replays;
  },
);

When('the player undoes the loss and reports it again', async ({ page }) => {
  await page.getByRole('button', { name: message('run.undo') }).click();
  await expect(page.getByText(message('set.playing'), { exact: true })).toBeVisible();
  await report(page, 'loss');
});

Then('the replays are the same, in the same order, with the same gear', async ({ page, world }) => {
  expect((await stored(page)).replays).toEqual(world.replaysDrawn);
  expect(await onScreen(page)).toEqual(world.first);
});

Given(
  'a player replaying after a reset, with {int} conquered kits',
  async ({ page, world }, conquered: number) => {
    const state = await seed(page, world, [...winsThenPlaying(conquered), 'loss', 'loss']);
    expect(state).toMatchObject({ conquered, cursor: 0, resets: 1 });
  },
);

When('the player is playing the fifth replay', async ({ page }) => {
  for (let n = 0; n < 4; n++) await report(page, 'win');
  expect((await stored(page)).cursor).toBe(4);
});

Given('a player on a replay, before any result for it', async ({ page, world }) => {
  await seed(page, world, [...winsThenPlaying(12), 'loss', 'loss']);
  world.before = await onScreen(page);
});

When('the player re-rolls its shoes', async ({ page }) => {
  const before = (await stored(page)).step;
  await page.getByRole('button', { name: message('reroll.label', { slot: 'shoes' }) }).click();
  await expect.poll(async () => (await stored(page)).step).toBeGreaterThan(before);
});

Then('the replay has other shoes', async ({ page, world }) => {
  const before = world.before as CurrentSet;
  const now = await onScreen(page);
  expect(now.kit).toBe(before.kit);
  expect(now.shoes).not.toBe(before.shoes);
  await expect(page.getByText(message('set.replay'), { exact: true })).toBeVisible();
});

Then('the shoes given up are not dealt out at the next reset', async ({ page, world }) => {
  // Played on by the engine's own actions from the run the page stored: every replay won, then
  // losses until the next reset.
  let s = await stored(page);
  const given = (world.before as CurrentSet).shoes;
  const act = { at, mode: 'Pnt', source: cryptoSource };
  while (isReplay(s)) s = reportWin(s, { ...act, step: s.step });
  const resets = s.resets;
  while (s.resets === resets) s = reportLoss(s, { ...act, step: s.step });
  expect(drawnReplays(s, s.resets).map((x) => x.shoes)).not.toContain(given);
});

Given(
  'a player on a replay who lost a match with it and has lives left',
  async ({ page, world }) => {
    // 10 replays won earn a second life; the eleventh replay is lost once.
    const state = await seed(page, world, [
      ...winsThenPlaying(12),
      'loss',
      'loss',
      ...winsThenPlaying(10),
      'loss',
    ]);
    expect(state).toMatchObject({ lives: 1, cursor: 10, resets: 1 });
  },
);

Then('each conquered kit is shown with the gear it was first conquered with', async ({ world }) => {
  const other = world.other as Page;
  const state = world.state as RunState;
  const items = other.getByRole('list', { name: message('shared.sets') }).getByRole('listitem');
  await expect(items).toHaveCount(state.conquered);
  for (let n = 0; n < state.conquered; n++) {
    const [kit, head, clothes, shoes] = setNames(state, n);
    for (const name of [kit, head, clothes, shoes])
      await expect(items.nth(n)).toContainText(name ?? '');
  }
});

Given(
  'a run started before replays were reshuffled, with {int} conquered sets and {int} life',
  async ({ page, world }, conquered: number, lives: number) => {
    const state = playRun(
      [...winsThenPlaying(conquered), ...Array<Play>(Math.floor(conquered / 10)).fill('loss')],
      undefined,
      undefined,
      undefined,
      'in-order',
    );
    expect(state).toMatchObject({ conquered, lives, resetRule: 'in-order' });
    world.state = state;
    await seedRun(page, state);
    await onScreen(page);
  },
);

Then(
  'the player replays the conquered sets in the order they were conquered, with the same gear',
  async ({ page, world }) => {
    const state = world.state as RunState;
    // Before the first replay is won: it offers no re-roll (checked by the next step).
    world.replayOnScreen = await onScreen(page);
    expect(world.replayOnScreen).toEqual(gearOf(state, 0));
    await page.getByRole('button', { name: message('run.won') }).waitFor();
  },
);

Then('the player is offered no re-roll on a replay', async ({ page, world }) => {
  const state = world.state as RunState;
  await expect(
    page.getByRole('button', { name: new RegExp(`^${message('reroll.button')}`) }),
  ).toHaveCount(0);
  const sets = await winReplays(page);
  expect(sets).toEqual(conquests(state).slice(0, sets.length));
  expect(sets).toHaveLength(state.conquered);
});

Given('a player who starts a new run', async ({ page }) => {
  await page.goto('./en-US/');
  await page.getByRole('button', { name: message('start.roll') }).click();
  await expect(page.getByRole('button', { name: message('run.won') })).toBeVisible();
});

Then('the run replays in a new order at each reset', async ({ page }) => {
  expect((await stored(page)).resetRule).toBe('reshuffle');
});
