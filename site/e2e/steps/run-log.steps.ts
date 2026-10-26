import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { currentSet, type RunState } from '../../src/run/engine';
import { Given, Then, When } from '../fixtures';
import { modeName, report } from '../support/report';
import { nameOf, playRun, seedRun, setNames, winsThenPlaying, type Play } from '../support/seed';
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

// One log entry as the catalogue words it: the whole sentence, never pieces of it.
type Entry = {
  result: 'win' | 'loss';
  kit: string;
  lives: number;
  conquered?: number;
  replay?: boolean;
  reset?: boolean;
  // Every result these steps report or seed is in Turf War, the first mode offered.
  mode?: string;
};
const sentence = (e: Entry) =>
  message('log.entry', {
    replay: String(e.replay ?? false),
    result: e.result,
    kit: e.kit,
    conquered: e.conquered ?? 0,
    total: 160,
    lives: message('run.lives', { lives: e.lives }),
    reset: String(e.reset ?? false),
    recorded: 'true',
    mode: e.mode ?? modeName('Pnt'),
    notRecorded: message('log.modeNotRecorded'),
  });

async function readSet(p: Page): Promise<string[]> {
  const images = pieceImages(p);
  await expect(images).toHaveCount(4);
  return images.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).alt));
}

// The run log's entries, newest first, opening the log if it is closed.
async function entries(p: Page) {
  const details = p.locator('details.run-log');
  await expect(details).toBeVisible();
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await details.locator('summary').click();
  }
  return p.getByRole('list', { name: message('log.title') }).getByRole('listitem');
}
const newest = async (p: Page) => (await entries(p)).first();

Given(
  'a player playing a set with {int} of {int} kits conquered',
  async ({ page, world }, conquered: number, total: number) => {
    const state = playRun(winsThenPlaying(conquered));
    expect(state.order.kits).toHaveLength(total);
    await seedRun(page, state);
    world.set = await readSet(page);
  },
);

Then('the newest entry of the run log is that set, marked as a win', async ({ page, world }) => {
  const [kit = ''] = world.set as string[];
  await expect(await newest(page)).toContainText(
    sentence({ result: 'win', kit, lives: 1, conquered: 4 }),
  );
});

Then(
  'it says {int} of {int} kits were conquered after it',
  async ({ page, world }, conquered: number, total: number) => {
    expect(total).toBe(160);
    const [kit = ''] = world.set as string[];
    await expect(await newest(page)).toContainText(
      sentence({ result: 'win', kit, lives: 1, conquered }),
    );
  },
);

Then(
  'the newest entry of the run log is that set, marked as a loss with {int} life left',
  async ({ page, world }, lives: number) => {
    const [kit = ''] = world.set as string[];
    await expect(await newest(page)).toContainText(sentence({ result: 'loss', kit, lives }));
  },
);

Then('the run log marks a reset right after that loss', async ({ page, world }) => {
  const state = world.state as RunState;
  const kit = setNames(state, state.cursor)[0] ?? '';
  await expect(await newest(page)).toContainText(
    sentence({ result: 'loss', kit, lives: 1, reset: true }),
  );
});

Then('the newest entry of the run log is marked as a replay', async ({ page, world }) => {
  const state = world.state as RunState;
  // The kit replayed: the first replay of the reset, which the reshuffled reset draws (FR-18), not
  // the first kit conquered.
  const kit = nameOf(currentSet(state).kit);
  await expect(await newest(page)).toContainText(
    sentence({ result: 'win', kit, lives: 1, conquered: state.conquered, replay: true }),
  );
});

Given('a player has just reported a result', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(3)));
  world.before = await (await entries(page)).allInnerTexts();
  await report(page, 'win');
  await expect(await entries(page)).toHaveCount((world.before as string[]).length + 1);
});

Then('that result is no longer in the run log', async ({ page, world }) => {
  await expect(await entries(page)).toHaveCount((world.before as string[]).length);
  expect(await (await entries(page)).allInnerTexts()).toEqual(world.before);
});

Given(
  'a player reported a win on {int} October {int}',
  async ({ page, world }, day: number, year: number) => {
    const when = new Date(Date.UTC(year, 9, day, 15)).toISOString();
    await seedRun(page, playRun(winsThenPlaying(1), undefined, when));
    world.when = when;
  },
);

Then(
  "the entry for that win shows that date, written for the player's locale",
  async ({ page, world }) => {
    const written = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
      new Date(world.when as string),
    );
    await expect((await newest(page)).locator('time')).toHaveText(written);
  },
);

Given('a run with {int} reported matches', async ({ page, world }, matches: number) => {
  // 150 wins (16 lives), then losses: the lives run out and the run resets; 200 results in all.
  const plays: Play[] = [
    ...winsThenPlaying(150),
    ...Array.from({ length: matches - 150 }, () => 'loss' as Play),
  ];
  const state = playRun(plays);
  expect(state.log).toHaveLength(matches);
  world.state = state;
  await seedRun(page, state);
  await readSet(page);
});

When('the player opens the run log', async ({ page }) => {
  await entries(page);
});

Then('it lists all {int} matches, the newest first', async ({ page, world }, matches: number) => {
  const list = await entries(page);
  await expect(list).toHaveCount(matches);
  const state = world.state as RunState;
  const last = state.log.at(-1);
  const first = state.log[0];
  if (!last || !first) throw new Error('steps: an empty log');
  const kitOf = (draw: number) => setNames(state, draw)[0] ?? '';
  await expect(list.first()).toContainText(
    sentence({ result: 'loss', kit: kitOf(last.draw), lives: last.livesAfter, reset: last.reset }),
  );
  await expect(list.last()).toContainText(
    sentence({ result: 'win', kit: kitOf(first.draw), lives: 1, conquered: 1 }),
  );
});

Given('a player who has reported a match', async ({ page, world }) => {
  const state = playRun(winsThenPlaying(1));
  await seedRun(page, state);
  world.entry = sentence({
    result: 'win',
    kit: setNames(state, 0)[0] ?? '',
    lives: 1,
    conquered: 1,
  });
});

When(
  'the player closes the browser and opens the site again',
  async ({ page, world, browser, baseURL }) => {
    const storageState = await page.context().storageState();
    await page.context().close();
    world.page = await (await browser.newContext({ storageState, baseURL })).newPage();
    await world.page.goto('./en-US/');
  },
);

Then('the run log still holds that match', async ({ world }) => {
  const list = await entries(world.page as Page);
  await expect(list).toHaveCount(1);
  await expect(list.first()).toContainText(world.entry as string);
});

Then(
  'each entry is read as one item, with the kit, the result and the lives left',
  async ({ page, world }) => {
    const list = await entries(page);
    const state = world.state as RunState;
    const last = state.log.at(-1);
    if (!last) throw new Error('steps: the seeded run has no results');
    const texts = await list.allInnerTexts();
    expect(texts).toHaveLength(state.log.length);
    // Each item carries its whole sentence: the newest names its own kit (the last one won, not the
    // set now on screen), its result and the lives after it.
    const kit = setNames(state, last.draw)[0] ?? '';
    expect(texts[0]).toContain(
      sentence({ result: 'win', kit, lives: last.livesAfter, conquered: last.conqueredAfter }),
    );
    for (const text of texts) expect(text).toMatch(/\d+ (life|lives) left/);
  },
);
