import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import type { RunState } from '../../src/run/engine';
import { packShare, widthsOf } from '../../src/share/link';
import { Given, Then, When } from '../fixtures';
import { messageIn } from '../support/messages';
import { askForMode, modeDialog, modes, modeName, report, tabTo } from '../support/report';
import { playRun, seedRun, setNames, winsThenPlaying } from '../support/seed';
import { pieceImages } from '../support/set';

const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const message = (id: string, values: Record<string, unknown> = {}) =>
  messageIn('en-US', id, values);
const set = async (p: Page) => {
  const images = pieceImages(p);
  await expect(images).toHaveCount(4);
  return images.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).alt));
};
const stored = (p: Page) => p.evaluate(() => localStorage.getItem('iron-squid:run'));
const logItems = async (p: Page) => {
  const details = p.locator('details.run-log');
  if (!(await details.evaluate((d) => (d as HTMLDetailsElement).open)))
    await details.locator('summary').click();
  return p.getByRole('list', { name: message('log.title') }).getByRole('listitem');
};

Given('a player playing a set', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(1)));
  world.set = await set(page);
  world.stored = await stored(page);
});

Then('the player is playing the same set', async ({ page, world }) => {
  expect(await set(page)).toEqual(world.set);
});

Then('the player is playing the set they won with, not yet conquered', async ({ page, world }) => {
  expect(await set(page)).toEqual(world.set);
  await expect(page.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: 3, total: 160 }),
  );
  await expect(page.locator('.just-conquered')).toHaveCount(0);
});

Then('the player is asked which mode the match was played in', async ({ page, world }) => {
  await expect(modeDialog(page, world.reportPending as 'win' | 'loss')).toBeVisible();
});

Then(
  'the choices are Turf War, Splat Zones, Tower Control, Rainmaker, Clam Blitz and Tricolor Turf War',
  async ({ page, world }) => {
    const dialog = modeDialog(page, world.reportPending as 'win' | 'loss');
    const offered = await dialog.getByRole('button').allInnerTexts();
    expect(offered).toEqual([...modes.map((m) => m.name), message('mode.cancel')]);
    expect(modes.map((m) => m.name)).toEqual([
      'Turf War',
      'Splat Zones',
      'Tower Control',
      'Rainmaker',
      'Clam Blitz',
      'Tricolor Turf War',
    ]);
  },
);

When(
  /^the player reports a (win|loss) in (.+)$/,
  async ({ page, world }, result: string, mode: string) => {
    world.set = await set(page);
    world.mode = mode;
    world.stored = await stored(page);
    await report(page, result as 'win' | 'loss', mode);
  },
);

Then('the player is told which set they just conquered', async ({ page, world }) => {
  const notice = page.locator('.just-conquered');
  await expect(notice).toContainText((world.set as string[])[0] ?? '');
  await expect(notice).toContainText(world.mode as string);
});

Then('the player is shown the next set without asking for it', async ({ page, world }) => {
  await expect(page.getByRole('button', { name: message('run.won') })).toBeVisible();
  expect((await set(page))[0]).not.toBe((world.set as string[])[0]);
});

When('dismisses the choice of mode', async ({ page, world }) => {
  const result = world.reportPending as 'win' | 'loss';
  world.reportPending = undefined;
  await modeDialog(page, result)
    .getByRole('button', { name: message('mode.cancel') })
    .click();
  await expect(modeDialog(page, result)).toBeHidden();
});

Then('no result is recorded', async ({ page, world }) => {
  expect(await stored(page)).toBe(world.stored);
});

Given('a player reported a win in Splat Zones and then a loss in Clam Blitz', async ({ page }) => {
  // Two lives, so the loss is a loss and not a reset.
  await seedRun(page, playRun(winsThenPlaying(10)));
  await report(page, 'win', 'Splat Zones');
  await report(page, 'loss', 'Clam Blitz');
});

Then('the newest entry is the loss, in Clam Blitz', async ({ page }) => {
  const newest = (await logItems(page)).first();
  await expect(newest).toContainText(message('log.markLoss'));
  await expect(newest).toContainText('Clam Blitz');
});

Then('the entry before it is the win, in Splat Zones', async ({ page }) => {
  const before = (await logItems(page)).nth(1);
  await expect(before).toContainText(message('log.markWin'));
  await expect(before).toContainText('Splat Zones');
});

Given(
  'a run whose first matches were reported before the site recorded modes',
  async ({ page, world }) => {
    const state = playRun(winsThenPlaying(2), undefined, undefined, null);
    expect(state.log.every((e) => e.mode === undefined)).toBe(true);
    world.state = state;
    await seedRun(page, state);
  },
);

Then('those matches say their mode was not recorded', async ({ page }) => {
  const items = await logItems(page);
  await expect(items).toHaveCount(2);
  for (const text of await items.allInnerTexts())
    expect(text).toContain(message('log.modeNotRecorded'));
});

Given(
  'a player has just reported a win in Turf War and been shown the next set',
  async ({ page, world }) => {
    await seedRun(page, playRun(winsThenPlaying(3)));
    world.set = await set(page);
    world.stored = await stored(page);
    await report(page, 'win', 'Turf War');
    expect((await set(page))[0]).not.toBe((world.set as string[])[0]);
  },
);

Then('the win is no longer in the run log', async ({ page }) => {
  await expect(await logItems(page)).toHaveCount(3);
});

Given(
  'a player who reported a win in Turf War, undid it, and reported it again in Rainmaker',
  async ({ page, world }) => {
    await seedRun(page, playRun(winsThenPlaying(3)));
    await report(page, 'win', 'Turf War');
    world.next = await set(page);
    await page.getByRole('button', { name: message('run.undo') }).click();
    await report(page, 'win', 'Rainmaker');
  },
);

Then('the player is shown the same next set as the first time', async ({ page, world }) => {
  expect(await set(page)).toEqual(world.next);
});

Given('a run file exported before the site recorded modes', async ({ world }) => {
  // Left on a conquered set, as the site before modes kept it until "Next set" was asked for.
  const state = playRun(winsThenPlaying(4), 'Inkling Ivo', undefined, null);
  const old = { ...state, cursor: state.cursor - 1, phase: 'conquered' };
  world.state = state;
  world.file = JSON.stringify({
    format: 'iron-squid-run',
    version: 1,
    exportedAt: '2026-10-24',
    run: old,
  });
});

When('the player imports it', async ({ page, world }) => {
  await page.goto('./en-US/');
  await page.getByLabel(message('run.import')).setInputFiles({
    name: 'iron-squid-run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(world.file as string),
  });
});

Then('the run continues where it was', async ({ page, world }) => {
  const state = world.state as RunState;
  await expect(page.locator('.run-title')).toHaveText('Inkling Ivo');
  expect(await set(page)).toEqual(setNames(state, state.cursor));
  await expect(page.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: 4, total: 160 }),
  );
});

Given('a player using only a keyboard', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(2)));
  world.keyboard = true;
  world.stored = await stored(page);
});

Then(
  'the player can choose any mode, and dismiss the choice, from the keyboard',
  async ({ page, world }) => {
    world.reportPending = undefined;
    // Opened from the keyboard, the choice has focus, and Escape dismisses it with nothing recorded.
    const dialog = modeDialog(page, 'win');
    await expect(dialog.getByRole('button', { name: modeName('Pnt'), exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await stored(page)).toBe(world.stored);
    // Chosen with Tab and Enter: the last mode, so every one before it is reachable.
    await askForMode(page, 'win', { keyboard: true });
    await tabTo(page, dialog.getByRole('button', { name: modeName('Tcl') }));
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.locator('.just-conquered')).toContainText(modeName('Tcl'));
  },
);

Then('the screen reader announces the conquered set and the next set', async ({ page, world }) => {
  const live = page.locator('.run-announcement[aria-live="polite"]');
  const [kit] = world.set as string[];
  const next = await set(page);
  await expect(live).toContainText(kit ?? '');
  await expect(live).toContainText('Splat Zones');
  await expect(live).toContainText(next[0] ?? '');
});

// The shared run (share-mode): the link carries the mode of each conquest.
const sharedSets = (p: Page) =>
  p.getByRole('list', { name: message('shared.sets') }).getByRole('listitem');

async function copyLink(p: Page): Promise<string> {
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await p.getByRole('button', { name: message('share.copy') }).click();
  await expect(p.getByRole('status').filter({ hasText: message('share.copied') })).toBeVisible();
  return p.evaluate(() => navigator.clipboard.readText());
}

// Opened where a stranger would open it: a browser with no run of its own.
async function openElsewhere(p: Page, link: string) {
  const browser = p.context().browser();
  if (!browser) throw new Error('steps: no browser to open the link in');
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other.getByRole('heading', { level: 1 })).toBeVisible();
  return other;
}

Given('a player conquered a set in Tower Control', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(1)));
  world.set = await set(page);
  await report(page, 'win', 'Tower Control');
});

When('a visitor opens a link to the run', async ({ page, world }) => {
  world.other = await openElsewhere(page, await copyLink(page));
});

Then('the conquered set is shown with Tower Control', async ({ world }) => {
  const items = sharedSets(world.other as Page);
  await expect(items).toHaveCount(2);
  await expect(items.nth(1)).toContainText((world.set as string[])[0] ?? '');
  await expect(items.nth(1)).toContainText('Tower Control');
  await expect(items.nth(0)).not.toContainText('Tower Control');
});

Given('a link to a run made before the site recorded modes', async ({ baseURL, world }) => {
  // Written in format 1, as the site wrote links before share-mode.
  const state = playRun(winsThenPlaying(3), 'Inkling Ivo', undefined, null);
  const places = (list: { id: string }[], ids: string[]) =>
    ids.slice(0, 3).map((id) => list.findIndex((i) => i.id === id));
  const columns = [
    places(catalogue.kits, state.order.kits),
    places(catalogue.gear.head, state.order.head),
    places(catalogue.gear.clothes, state.order.clothes),
    places(catalogue.gear.shoes, state.order.shoes),
  ];
  const sets = [0, 1, 2].map((n) => columns.map((c) => c[n] ?? 0));
  world.state = state;
  world.link = `${baseURL}en-US/run/#${packShare(
    {
      version: catalogue.version,
      name: new TextEncoder().encode('Inkling Ivo'),
      conquered: 3,
      lives: state.lives,
      resets: state.resets,
      sets,
    },
    widthsOf(catalogue, 1),
    1,
  )}`;
});

When('a visitor opens it', async ({ page, world }) => {
  world.other = await openElsewhere(page, world.link as string);
});

Then('the run is shown as it was, with no mode on its sets', async ({ world }) => {
  const other = world.other as Page;
  const state = world.state as RunState;
  await expect(other.getByRole('heading', { level: 1 })).toHaveText('Inkling Ivo');
  const items = sharedSets(other);
  await expect(items).toHaveCount(3);
  for (let n = 0; n < 3; n++) {
    const [kit, head, clothes, shoes] = setNames(state, n);
    await expect(items.nth(n)).toHaveText(
      message('shared.set', {
        number: n + 1,
        kit,
        head,
        clothes,
        shoes,
        recorded: 'false',
        mode: '',
      }),
    );
  }
});

Given(
  'a complete run of {int} kits, each won in a mode, with a display name of {int} characters',
  async ({ page }, kits: number, length: number) => {
    // Characters as the player sees them, an emoji among them, as the name field counts them.
    const count = (s: string) => [...new Intl.Segmenter().segment(s)].length;
    let name = 'Iñigo, Ñandú 🦑 ';
    while (count(name) < length) name += 'é';
    expect(count(name)).toBe(length);
    // Tricolor Turf War: the last mode, so its index takes every bit the mode field has.
    const state = playRun(winsThenPlaying(kits), name, undefined, 'Tcl');
    expect(state.conquered).toBe(kits);
    expect(state.log.every((e) => e.mode === 'Tcl')).toBe(true);
    await seedRun(page, state);
  },
);
