// The run screen's own worst failures (task run-screen) and the storage ones it can now drive (task
// run-storage), as end-to-end tests under the same guard as every scenario.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { test } from '../fixtures';
import { askForMode, modeDialog, modeName, report } from '../support/report';

const catalogue = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) =>
  String(new IntlMessageFormat(catalogue[id] ?? '', 'en-US').format(values));
const button = (p: Page, id: string) => p.getByRole('button', { name: message(id) });

async function startRun(p: Page, name = '') {
  await p.goto('./en-US/');
  if (name) await p.getByLabel(message('start.nameLabel')).fill(name);
  await button(p, 'start.roll').click();
  await expect(button(p, 'run.won')).toBeVisible();
}

// A double click on a mode records one result, never two (report-with-mode, failure 3). The mode
// dialog closes on the first click and the next set is drawn at once, so the second click lands on
// whatever is now under the pointer: "I won" of a set never played, among others.
async function doubleClickAt(p: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('test: nothing to double-click on screen');
  await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
}

test('a double click on a mode records one result, never two', async ({ page }) => {
  await startRun(page);
  await askForMode(page, 'win');
  await doubleClickAt(
    page,
    modeDialog(page, 'win').getByRole('button', { name: modeName('Pnt'), exact: true }),
  );
  await expect(
    page.getByText(message('run.conquered', { conquered: 1, total: 160 }), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(message('set.weaponNumber', { number: 2, total: 160 })),
  ).toBeVisible();
  // Nothing more: no second result, and no choice of mode opened for the set just drawn.
  await expect(modeDialog(page, 'win')).toBeHidden();
  await expect(
    page.getByText(message('run.conquered', { conquered: 1, total: 160 }), { exact: true }),
  ).toBeVisible();
});

// Wherever the layout puts a mode under the pointer, the second click of a double click (on "I won",
// say) is not a choice: it records nothing.
test('the second click of a double click never chooses a mode', async ({ page }) => {
  await startRun(page);
  await askForMode(page, 'win');
  const turfWar = modeDialog(page, 'win').getByRole('button', {
    name: modeName('Pnt'),
    exact: true,
  });
  await turfWar.dispatchEvent('click', { detail: 2 });
  await expect(modeDialog(page, 'win')).toBeVisible();
  await expect(
    page.getByText(message('run.conquered', { conquered: 0, total: 160 }), { exact: true }),
  ).toBeVisible();
});

test('a win in one tab shows in the other, which cannot undo it by acting on what it showed', async ({
  page,
}) => {
  await startRun(page);
  const other = await page.context().newPage();
  await other.goto('./en-US/');
  await expect(button(other, 'run.won')).toBeVisible();
  await report(page, 'win');
  // The other tab follows without a reload, and says why its screen changed.
  await expect(other.locator('.just-conquered')).toBeVisible();
  await expect(other.getByText(message('run.updatedElsewhere'))).toBeVisible();
  await expect(
    other.getByText(message('run.conquered', { conquered: 1, total: 160 }), { exact: true }),
  ).toBeVisible();
});

test('a run that cannot be read is reported and left untouched, never replaced silently', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('iron-squid:run', '{"revision": 3, "state": ');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('./en-US/');
  await expect(page.getByRole('alert')).toContainText(
    message('run.unreadable', { detail: '' }).split(':')[0] ?? '',
  );
  await expect(button(page, 'start.roll')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('iron-squid:run'))).toBe(
    '{"revision": 3, "state": ',
  );
});

test('starting over works from the keyboard alone, and Escape declines', async ({ page }) => {
  await startRun(page);
  const before = await page
    .getByRole('region', { name: message('set.label') })
    .getByRole('img')
    .first()
    .getAttribute('alt');
  const newRun = button(page, 'run.newRun');
  await newRun.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Focus is inside the dialog, on the choice that keeps the run, and Tab stays inside.
  await expect(button(page, 'newRun.keep')).toBeFocused();
  // Tab never reaches the page behind the modal: it stays in the dialog, or leaves the document
  // for the browser's own controls (activeElement is then the body), as a native modal does.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate(
        (d) => d.contains(document.activeElement) || document.activeElement === document.body,
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(newRun).toBeFocused();
  expect(
    await page
      .getByRole('region', { name: message('set.label') })
      .getByRole('img')
      .first()
      .getAttribute('alt'),
  ).toBe(before);
});

test.describe('on a narrow phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the start and the run fit the width, and names are counted as the player sees them', async ({
    page,
  }) => {
    await page.goto('./en-US/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    await page.getByLabel(message('start.nameLabel')).fill('🦑'.repeat(31));
    await button(page, 'start.roll').click();
    await expect(
      page.getByText(message('start.nameTooLong', { max: 30, length: 31 })),
    ).toBeVisible();
    await page.getByLabel(message('start.nameLabel')).fill('🦑'.repeat(30));
    await button(page, 'start.roll').click();
    await expect(page.getByRole('heading', { name: '🦑'.repeat(30), exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});

test('a display name is shown as text, never as markup', async ({ page }) => {
  await startRun(page, '<b>Ivo</b>');
  await expect(page.getByRole('heading', { name: '<b>Ivo</b>', exact: true })).toBeVisible();
  expect(await page.locator('h1 b').count()).toBe(0);
});

// The numbers on screen are the run's, not a count kept by the page (task report-screen, failure
// 2): after a loss, an undo and a reset, the strip says what a fresh load of the same run says.
test('after a loss, an undo and a reset, the strip matches a fresh load of the run', async ({
  page,
}) => {
  const { playRun, seedRun, winsThenPlaying } = await import('../support/seed');
  await seedRun(page, playRun(winsThenPlaying(12)));
  const strip = page.locator('.ink-strip');
  const freshly = async () => {
    const shown = (await strip.innerText()).trim();
    await page.reload();
    await expect(button(page, 'run.won')).toBeVisible();
    expect((await strip.innerText()).trim()).toBe(shown);
  };
  await expect(button(page, 'run.won')).toBeVisible();
  await report(page, 'loss');
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 1 }) })).toBeVisible();
  await freshly();
  await button(page, 'run.undo').click();
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 2 }) })).toBeVisible();
  await freshly();
  await report(page, 'loss');
  await report(page, 'loss');
  await expect(page.getByText(message('run.resets', { resets: 1 }), { exact: true })).toBeVisible();
  await expect(page.getByText(message('run.resetNotice'))).toBeVisible();
  await freshly();
});

// A reset during a replay is the one that matters most (task replay-screen, failure 3): after it,
// the strip and the card say what a fresh load of the same run says.
test('after a reset during a replay, the strip and the card match a fresh load', async ({
  page,
}) => {
  const { playRun, seedRun, winsThenPlaying } = await import('../support/seed');
  // 12 conquered, reset, then 6 replay wins: replaying the seventh, with 1 life.
  await seedRun(page, playRun([...winsThenPlaying(12), 'loss', 'loss', ...winsThenPlaying(6)]));
  await expect(page.getByText(message('set.replay'), { exact: true })).toBeVisible();
  await report(page, 'loss');
  await expect(page.getByText(message('run.resets', { resets: 2 }), { exact: true })).toBeVisible();
  const read = async () => ({
    strip: (await page.locator('.ink-strip').innerText()).trim(),
    card: (await page.getByRole('region', { name: message('set.label') }).innerText()).trim(),
  });
  const shown = await read();
  expect(shown.card).toContain(message('set.replaysRemaining', { remaining: 12 }));
  await page.reload();
  await expect(button(page, 'run.won')).toBeVisible();
  expect(await read()).toEqual(shown);
});

// A run saved before format 2 existed opens, plays on and is stored in format 2, its log starting
// the day it was read (task run-log-format, failure 1).
test('a run saved in format 1 loads, plays on, and is kept in format 2 with its log', async ({
  page,
}) => {
  const { playRun, winsThenPlaying } = await import('../support/seed');
  const played = playRun(winsThenPlaying(3));
  // The same run as the site wrote it in format 1: no log, no log date, no re-rolls.
  const asFormat1 = (s: Record<string, unknown>) => {
    const { log: _log, logSince: _since, worn: _w, spent: _s, rerolls: _r, previous, ...rest } = s;
    void [_log, _since, _w, _s, _r];
    return {
      ...rest,
      schema: 1,
      ...(previous ? { previous: { ...(previous as Record<string, unknown>), schema: 1 } } : {}),
    };
  };
  await page.addInitScript(
    (record) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('iron-squid:run', record);
        sessionStorage.setItem('seeded', '1');
      }
    },
    JSON.stringify({ revision: 1, state: asFormat1(played as unknown as Record<string, unknown>) }),
  );
  await page.goto('./en-US/');
  await expect(
    page.getByText(message('run.conquered', { conquered: 3, total: 160 }), { exact: true }),
  ).toBeVisible();
  await report(page, 'win');
  await expect(
    page.getByText(message('run.conquered', { conquered: 4, total: 160 }), { exact: true }),
  ).toBeVisible();
  const stored = JSON.parse(
    (await page.evaluate(() => localStorage.getItem('iron-squid:run'))) ?? '{}',
  );
  expect(stored.state.schema).toBe(3);
  expect(stored.state.log).toHaveLength(1);
  expect(stored.state.log[0]).toMatchObject({ draw: 3, result: 'win' });
  // The log starts when the run was read, not when it was started.
  expect(stored.state.logSince).not.toBe(played.startedAt);
  expect(Math.abs(Date.now() - Date.parse(stored.state.logSince))).toBeLessThan(60_000);
  await page.reload();
  await expect(
    page.getByText(message('run.conquered', { conquered: 4, total: 160 }), { exact: true }),
  ).toBeVisible();
});

// A run whose log began part-way (migrated from format 1) never shows a part of its wins and losses
// as the whole (task finish-screen, failure 2).
test('a completed run whose log began part-way says from when wins and losses were counted', async ({
  page,
}) => {
  const { playRun, winsThenPlaying } = await import('../support/seed');
  const played = playRun(winsThenPlaying(159));
  const {
    log: _log,
    logSince: _since,
    worn: _worn,
    spent: _spent,
    rerolls: _rerolls,
    previous,
    ...rest
  } = played as unknown as Record<string, unknown>;
  void [_log, _since, _worn, _spent, _rerolls];
  const format1 = {
    ...rest,
    schema: 1,
    ...(previous ? { previous: { ...(previous as object), schema: 1 } } : {}),
  };
  await page.addInitScript(
    (record) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('iron-squid:run', record);
        sessionStorage.setItem('seeded', '1');
      }
    },
    JSON.stringify({ revision: 1, state: format1 }),
  );
  await page.goto('./en-US/');
  await report(page, 'win');
  await expect(page.getByRole('heading', { name: message('finish.title') })).toBeVisible();
  // One win in the log, out of 160 matches: the card says the count is partial.
  await expect(
    page.getByText(message('finish.summary', { matches: 160, wins: 1, losses: 0, resets: 0 })),
  ).toBeVisible();
  await expect(page.getByText(/Wins and losses are counted from/)).toBeVisible();
});
