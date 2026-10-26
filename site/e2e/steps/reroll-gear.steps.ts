import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Catalogue, GearSlot, NamesFile } from '../../src/catalogue/types';
import { gearOf, reportWin, type RunState } from '../../src/run/engine';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { report, tabTo } from '../support/report';
import { playRun, rerolledRun, seedRun, winsThenPlaying } from '../support/seed';

const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const english = (
  JSON.parse(readFileSync('src/catalogue/11.3.0/names/en-US.json', 'utf8')) as NamesFile
).names;
const idOf = (name: string) => {
  const id = Object.keys(english).find((k) => english[k] === name);
  if (!id) throw new Error(`steps: no item named ${name}`);
  return id;
};
const message = (id: string, values: Record<string, unknown> = {}) =>
  messageIn('en-US', id, values);
const slots = ['head', 'clothes', 'shoes'] as const;
const spares = (slot: GearSlot) => catalogue.gear[slot].length - catalogue.kits.length;

const rerollButton = (p: Page, slot: GearSlot) =>
  p.getByRole('button', { name: message('reroll.label', { slot }) });
const anyReroll = (p: Page) =>
  p.getByRole('button', { name: new RegExp(`^${message('reroll.button')}`) });

// The run as the page stored it, and the set it is playing, by id.
const stored = async (p: Page) =>
  (
    JSON.parse((await p.evaluate(() => localStorage.getItem('iron-squid:run'))) ?? '{}') as {
      state: RunState;
    }
  ).state;
const playing = async (p: Page) => {
  const s = await stored(p);
  return gearOf(s, s.cursor);
};

async function rerollIn(p: Page, slot: GearSlot) {
  const before = (await stored(p)).step;
  await rerollButton(p, slot).click();
  await expect.poll(async () => (await stored(p)).step).toBeGreaterThan(before);
}

// A run playing a new draw whose shoes are the named piece: the order is the engine's, with that
// piece swapped into the place of the current set's shoes, as a draw could have placed it.
function withShoes(name: string): RunState {
  const s = playRun(winsThenPlaying(2));
  const shoes = [...s.order.shoes];
  const from = shoes.indexOf(idOf(name));
  [shoes[from], shoes[s.cursor]] = [shoes[s.cursor] ?? '', shoes[from] ?? ''];
  return { ...s, order: { ...s.order, shoes } };
}

Given(
  'a player has been given a set with the shoes {string}',
  async ({ page, world }, name: string) => {
    await seedRun(page, withShoes(name));
    world.before = await playing(page);
    expect((world.before as { shoes: string }).shoes).toBe(idOf(name));
  },
);

When('the player re-rolls the shoes', async ({ page, world }) => {
  world.before ??= await playing(page);
  await rerollIn(page, 'shoes');
});

Then('the set has other shoes', async ({ page, world }) => {
  const set = page.getByRole('region', { name: message('set.label') });
  const now = await playing(page);
  expect(now.shoes).not.toBe((world.before as { shoes: string }).shoes);
  await expect(set.getByRole('img', { name: english[now.shoes], exact: true })).toBeVisible();
});

Then('its kit, headgear and clothing are unchanged', async ({ page, world }) => {
  const before = world.before as Record<string, string>;
  const now = await playing(page);
  expect({ kit: now.kit, head: now.head, clothes: now.clothes }).toEqual({
    kit: before.kit,
    head: before.head,
    clothes: before.clothes,
  });
});

Then(
  'the player is offered a re-roll for the headgear, the clothing and the shoes',
  async ({ page }) => {
    for (const slot of slots) await expect(rerollButton(page, slot)).toBeVisible();
  },
);

Then('none for the kit', async ({ page }) => {
  await expect(anyReroll(page)).toHaveCount(3);
  const kit = page.locator('.piece-kit');
  await expect(kit.getByRole('button')).toHaveCount(0);
});

Given('a player re-rolled away the shoes {string}', async ({ page, world }, name: string) => {
  await seedRun(page, withShoes(name));
  await rerollIn(page, 'shoes');
  world.given = idOf(name);
});

When('the player plays on through every remaining set of the run', async ({ page, world }) => {
  // Played by the engine's own wins from the run the page stored: every set the run will draw.
  let s = await stored(page);
  const worn: string[] = [];
  while (s.phase === 'playing') {
    worn.push(gearOf(s, s.cursor).shoes);
    s = reportWin(s, { step: s.step, at: '2026-10-26T12:00:00.000Z', mode: 'Pnt' });
  }
  expect(s.conquered).toBe(160);
  world.worn = worn;
});

Then('{string} is never drawn again', async ({ world }, name: string) => {
  expect(world.worn as string[]).not.toContain(idOf(name));
});

When('the player re-rolls the headgear three times', async ({ page, world }) => {
  world.heads = [(await playing(page)).head];
  for (let n = 0; n < 3; n++) {
    await rerollIn(page, 'head');
    (world.heads as string[]).push((await playing(page)).head);
  }
});

Then('the set has a fourth headgear', async ({ page, world }) => {
  const heads = world.heads as string[];
  expect(new Set(heads).size).toBe(4);
  const set = page.getByRole('region', { name: message('set.label') });
  await expect(set.getByRole('img', { name: english[heads[3] ?? ''], exact: true })).toBeVisible();
});

Then('the three before it are spent', async ({ page, world }) => {
  const s = await stored(page);
  expect(s.rerolls.map((r) => r.from)).toEqual((world.heads as string[]).slice(0, 3));
});

// A run 5 kits from its end, with its spare shoes spent down to `left` (5 or 6 unused besides the
// current set's, of which 5 are the shoes of the sets still to draw).
Given(
  'a run with {int} kits still to draw after the current set',
  async ({ world }, kits: number) => {
    world.kitsLeft = kits;
  },
);

Given(
  "{int} shoes not yet used, besides the current set's",
  async ({ page, world }, unused: number) => {
    const kitsLeft = world.kitsLeft as number;
    const wins = catalogue.kits.length - 1 - kitsLeft;
    const state = rerolledRun(
      'shoes',
      spares('shoes') - (unused - kitsLeft),
      winsThenPlaying(wins),
    );
    expect(state.cursor).toBe(wins);
    await seedRun(page, state);
    world.before = await playing(page);
  },
);

When('the player tries to re-roll the shoes', async ({ page, world }) => {
  world.storedBefore = await page.evaluate(() => localStorage.getItem('iron-squid:run'));
  await rerollButton(page, 'shoes').click();
});

Then('the re-roll is refused', async ({ page, world }) => {
  expect(await page.evaluate(() => localStorage.getItem('iron-squid:run'))).toBe(
    world.storedBefore,
  );
});

Then(
  'the player is told there are no more shoes to spare than the kits still to draw',
  async ({ page }) => {
    await expect(
      page.getByRole('status').filter({ hasText: message('reroll.noSpare', { slot: 'shoes' }) }),
    ).toBeVisible();
  },
);

Given('a player who lost a match with the current set and has lives left', async ({ page }) => {
  await seedRun(page, playRun([...winsThenPlaying(10), 'loss']));
});

Given(
  'a player replaying a conquered set after a reset, in a run started before replays were reshuffled',
  async ({ page }) => {
    await seedRun(
      page,
      playRun([...winsThenPlaying(3), 'loss'], undefined, undefined, undefined, 'in-order'),
    );
  },
);

Then('the player is offered no re-roll', async ({ page }) => {
  await expect(page.getByRole('button', { name: message('run.won') })).toBeVisible();
  await expect(anyReroll(page)).toHaveCount(0);
});

Given('a player re-rolled the clothing of the current set', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(2)));
  await rerollIn(page, 'clothes');
  world.clothes = (await playing(page)).clothes;
});

Then('the set has the clothing it was re-rolled to', async ({ page, world }) => {
  const set = page.getByRole('region', { name: message('set.label') });
  await expect(
    set.getByRole('img', { name: english[world.clothes as string], exact: true }),
  ).toBeVisible();
});

Given('two copies of the same run, at the same set', async ({ page, browser, world }) => {
  const state = playRun(winsThenPlaying(5));
  await seedRun(page, state);
  const other = await (await browser.newContext()).newPage();
  await seedRun(other, state);
  world.other = other;
});

When('the player re-rolls the shoes in each', async ({ page, world }) => {
  await rerollIn(page, 'shoes');
  await rerollIn(world.other as Page, 'shoes');
});

Then('both get the same shoes', async ({ page, world }) => {
  const [a, b] = [await playing(page), await playing(world.other as Page)];
  expect(a.shoes).toBe(b.shoes);
});

Given('a player has just re-rolled the shoes', async ({ page }) => {
  // After a win, which could be undone until the re-roll.
  await seedRun(page, playRun(winsThenPlaying(3)));
  await expect(page.getByRole('button', { name: message('run.undo') })).toBeVisible();
  await rerollIn(page, 'shoes');
});

Then('the player is offered no way to undo the re-roll', async ({ page }) => {
  await expect(page.getByRole('button', { name: message('run.undo') })).toHaveCount(0);
});

Given('a player re-rolled the headgear and then reported a loss', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(10))); // 2 lives
  await rerollIn(page, 'head');
  world.head = (await playing(page)).head;
  await report(page, 'loss');
});

When('the player undoes the loss', async ({ page }) => {
  await page.getByRole('button', { name: message('run.undo') }).click();
  await expect(page.getByRole('button', { name: message('run.undo') })).toHaveCount(0);
});

Then('the set still has the re-rolled headgear', async ({ page, world }) => {
  expect((await playing(page)).head).toBe(world.head);
  const set = page.getByRole('region', { name: message('set.label') });
  await expect(
    set.getByRole('img', { name: english[world.head as string], exact: true }),
  ).toBeVisible();
});

Then(
  'the log says {string} was re-rolled away, where it happened',
  async ({ page, world }, name: string) => {
    const s = await stored(page);
    const list = page.getByRole('list', { name: message('log.title') }).getByRole('listitem');
    const to = english[s.rerolls[0]?.to ?? ''];
    // Newest first: the re-roll, made on the set after the last result, is above that result.
    await expect(list.first()).toContainText(message('log.reroll', { from: name, to }));
    void world;
  },
);

Then('the player can re-roll each gear piece from the keyboard', async ({ page }) => {
  for (const slot of slots) {
    const before = (await stored(page)).step;
    await tabTo(page, rerollButton(page, slot));
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await stored(page)).step).toBeGreaterThan(before);
  }
});

When('the player re-rolls the clothing', async ({ page }) => {
  await rerollIn(page, 'clothes');
});

Then('the screen reader announces the new clothing', async ({ page }) => {
  const piece = english[(await playing(page)).clothes] ?? '';
  const live = page.locator('.run-announcement[aria-live="polite"]');
  await expect(live).toHaveText(message('reroll.announce', { slot: 'clothes', piece }));
});

// share-rerolls: the link counts the pieces re-rolled away, and the shared page says how many.
Given('a run in which {int} pieces were re-rolled away', async ({ page }, pieces: number) => {
  const state = rerolledRun('head', pieces, winsThenPlaying(3));
  expect(state.rerolls).toHaveLength(pieces);
  await seedRun(page, state);
});

Then(
  'the visitor is shown that {int} pieces were re-rolled away',
  async ({ world }, pieces: number) => {
    const other = world.other as Page;
    const stat = other
      .locator('.shared-numbers > div')
      .filter({ has: other.getByText(message('shared.statRerolls'), { exact: true }) });
    await expect(stat.locator('dd')).toHaveText(String(pieces));
  },
);
