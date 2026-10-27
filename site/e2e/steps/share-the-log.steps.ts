import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import {
  reportLoss,
  reportWin,
  startRun,
  type ResetRule,
  type RunState,
} from '../../src/run/engine';
import { cryptoSource } from '../../src/run/random';
import { decodeShare, packShare, widthsOf } from '../../src/share/link';
import { Given, Then } from '../fixtures';
import { messageIn } from '../support/messages';
import { modeName } from '../support/report';
import { nameOf, seedRun } from '../support/seed';

// shared-log: a shared run shows its log, without dates, and its longest winning streak. Runs are
// played by the engine's own actions, each result in the mode the scenario names.
const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const message = (id: string, values: Record<string, unknown> = {}) =>
  messageIn('en-US', id, values);
const at = '2026-10-20T12:00:00.000Z';

type Play = { result: 'win' | 'loss'; mode?: string };
const wins = (n: number, mode = 'Pnt'): Play[] => Array(n).fill({ result: 'win', mode });
const loss = (mode = 'Pnt'): Play => ({ result: 'loss', mode });

function play(plays: Play[], name?: string, resetRule: ResetRule = 'restart'): RunState {
  let s = startRun(catalogue, { name, resetRule }, cryptoSource, at);
  for (const p of plays) {
    const action = { step: s.step, at, mode: p.mode ?? 'Pnt', source: cryptoSource };
    s = p.result === 'win' ? reportWin(s, action) : reportLoss(s, action);
  }
  return s;
}

async function seed(page: Page, world: Record<string, unknown>, state: RunState) {
  world.state = state;
  await seedRun(page, state);
  // The run on screen, playing or complete: its title is there either way.
  await expect(page.locator('.run-title')).toBeVisible();
}

// The shared log on the visitor's page, opened if it is closed, newest first.
async function sharedLog(p: Page) {
  const details = p.locator('details.shared-log');
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open)))
    await details.locator('summary').click();
  return p.getByRole('list', { name: message('log.title') }).getByRole('listitem');
}

Given(
  'a run of {int} wins, a loss in Splat Zones and {int} more wins',
  async ({ page, world }, before: number, after: number) => {
    await seed(page, world, play([...wins(before), loss('Var'), ...wins(after)]));
  },
);

Then('the visitor sees its {int} matches, newest first', async ({ world }, matches: number) => {
  const items = await sharedLog(world.other as Page);
  await expect(items).toHaveCount(matches);
  const state = world.state as RunState;
  const newest = state.log.at(-1);
  await expect(items.first()).toContainText(
    nameOf(newest?.kit ?? state.order.kits[newest?.draw ?? -1]),
  );
});

Then('each says its result, its kit and its mode', async ({ world }) => {
  const items = await sharedLog(world.other as Page);
  const state = world.state as RunState;
  const entries = [...state.log].reverse();
  for (const [i, e] of entries.entries()) {
    const item = items.nth(i);
    await expect(item).toContainText(nameOf(e.kit ?? state.order.kits[e.draw]));
    await expect(item).toContainText(modeName(e.mode ?? ''));
    await expect(item).toContainText(message(e.result === 'win' ? 'log.markWin' : 'log.markLoss'));
  }
});

Then('no match on the shared log shows a date', async ({ world }) => {
  const items = await sharedLog(world.other as Page);
  await expect(items.locator('time')).toHaveCount(0);
  for (const text of await items.allInnerTexts()) expect(text).not.toMatch(/2026|October/);
});

Given(
  'a run begun under the reshuffled reset that lost its last life and won a replay',
  async ({ page, world }) => {
    await seed(page, world, play([...wins(3), loss(), ...wins(1)], undefined, 'reshuffle'));
  },
);

Then('the shared log marks the loss that reset the run', async ({ world }) => {
  const items = await sharedLog(world.other as Page);
  await expect(items.nth(1)).toContainText(message('shared.logReset'));
});

Then('marks the replay as a replay', async ({ world }) => {
  const items = await sharedLog(world.other as Page);
  await expect(items.first()).toContainText(message('shared.logReplay'));
});

Given(
  'a run of {int} wins, a loss, {int} wins, a loss and {int} wins',
  async ({ page, world }, a: number, b: number, c: number) => {
    await seed(page, world, play([...wins(a), loss(), ...wins(b), loss(), ...wins(c)]));
  },
);

Then(
  'the visitor is shown a longest winning streak of {int}',
  async ({ world }, streak: number) => {
    const other = world.other as Page;
    const stat = other
      .locator('.shared-numbers > div')
      .filter({ has: other.getByText(message('shared.statStreak'), { exact: true }) });
    await expect(stat.locator('dd')).toHaveText(String(streak));
  },
);

Given(
  'a run begun under the reshuffled reset that reset, then won its {int} replays and {int} new sets',
  async ({ page, world }, replays: number, fresh: number) => {
    // `replays` wins earn a second life: the first loss spends it, the second resets.
    const state = play(
      [...wins(replays), loss(), loss(), ...wins(replays + fresh)],
      undefined,
      'reshuffle',
    );
    expect(state.resets).toBe(1);
    await seed(page, world, state);
  },
);

Given(
  'a complete run of {int} matches with a display name of {int} characters',
  async ({ page, world }, matches: number, length: number) => {
    const count = (s: string) => [...new Intl.Segmenter().segment(s)].length;
    let name = 'Iñigo, Ñandú 🦑 ';
    while (count(name) < length) name += 'é';
    // Losses on every new set past the fifth reset the run again and again; then it is won.
    let s = startRun(catalogue, { name }, cryptoSource, at);
    const act = () => ({ step: s.step, at, mode: 'Pnt', source: cryptoSource });
    while (s.matches < matches && s.phase === 'playing')
      s = s.conquered >= 5 && s.cursor === s.conquered ? reportLoss(s, act()) : reportWin(s, act());
    while (s.phase === 'playing') s = reportWin(s, act());
    expect(s.matches).toBeGreaterThanOrEqual(matches);
    await seed(page, world, s);
  },
);

Then(
  'a visitor sees the most recent matches, told how many earlier ones are left out',
  async ({ page, world }) => {
    const link = world.link as string;
    const shared = decodeShare(link.split('#')[1] ?? '', { [catalogue.version]: catalogue });
    expect(shared.ok).toBe(true);
    if (!shared.ok) return;
    const carried = shared.run.log?.length ?? 0;
    const state = world.state as RunState;
    expect(shared.run.logOmitted).toBe(state.matches - carried);
    const browser = page.context().browser();
    if (!browser) throw new Error('steps: no browser to open the link in');
    const other = await (await browser.newContext()).newPage();
    await other.goto(link);
    // Opening the log shows its matches, and says how many earlier ones the link leaves out.
    await expect(await sharedLog(other)).toHaveCount(carried);
    await expect(
      other.getByText(message('shared.logOmitted', { count: shared.run.logOmitted })),
    ).toBeVisible();
    // Hundreds of matches stay inside a phone's screen: none pushed past its edge.
    await other.setViewportSize({ width: 360, height: 800 });
    const outside = await (
      await sharedLog(other)
    ).evaluateAll((items) => items.filter((i) => i.getBoundingClientRect().right > 360).length);
    expect(outside).toBe(0);
  },
);

Given('a link to a run made before the log was shared', async ({ baseURL, world }) => {
  // Written in format 3, as the site wrote links before share-log-codec.
  const state = play(wins(3), 'Inkling Ivo');
  const place = (list: { id: string }[], id: string | undefined) =>
    list.findIndex((i) => i.id === id);
  const modes = catalogue.modes.map((m) => m.id);
  const sets = [0, 1, 2].map((n) => [
    place(catalogue.kits, state.order.kits[n]),
    place(catalogue.gear.head, state.order.head[n]),
    place(catalogue.gear.clothes, state.order.clothes[n]),
    place(catalogue.gear.shoes, state.order.shoes[n]),
    modes.indexOf('Pnt') + 1,
  ]);
  world.state = state;
  world.link = `${baseURL}en-US/run/#${packShare(
    {
      version: catalogue.version,
      name: new TextEncoder().encode('Inkling Ivo'),
      conquered: 3,
      lives: state.lives,
      resets: 0,
      rerolls: 0,
      sets,
    },
    widthsOf(catalogue, 3),
    3,
  )}`;
});

Then('the run is shown as it was', async ({ world }) => {
  const other = world.other as Page;
  await expect(other.getByRole('heading', { level: 1 })).toHaveText('Inkling Ivo');
  await expect(other.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: 3, total: 160 }),
  );
});

Then('the visitor is told the link carries no log', async ({ world }) => {
  const other = world.other as Page;
  await expect(other.getByText(message('shared.noLog'))).toBeVisible();
  await expect(other.locator('details.shared-log')).toHaveCount(0);
});
