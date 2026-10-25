// The run screen's own worst failures (task run-screen) and the storage ones it can now drive (task
// run-storage), as end-to-end tests under the same guard as every scenario.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { test } from '../fixtures';

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

// After a result the next button appears where the last one was, so the second click of a double
// click lands on it: on "Next set" it would report a win for a set never played. A real mouse,
// double-clicking one point, must move the run exactly one step.
async function doubleClickAt(p: Page, id: string) {
  const box = await button(p, id).boundingBox();
  if (!box) throw new Error(`test: no "${id}" button on screen`);
  await p.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
}

test('a double click moves the run one step, never two', async ({ page }) => {
  await startRun(page);
  await doubleClickAt(page, 'run.won');
  await expect(button(page, 'run.next')).toBeVisible();
  await expect(
    page.getByText(message('run.conquered', { conquered: 1, total: 160 }), { exact: true }),
  ).toBeVisible();
  await doubleClickAt(page, 'run.next');
  await expect(button(page, 'run.won')).toBeVisible();
  await expect(
    page.getByText(message('set.weaponNumber', { number: 2, total: 160 })),
  ).toBeVisible();
  // Still one kit conquered: the second click did not report a win for the set just drawn.
  await expect(
    page.getByText(message('run.conquered', { conquered: 1, total: 160 }), { exact: true }),
  ).toBeVisible();
});

test('a win in one tab shows in the other, which cannot undo it by acting on what it showed', async ({
  page,
}) => {
  await startRun(page);
  const other = await page.context().newPage();
  await other.goto('./en-US/');
  await expect(button(other, 'run.won')).toBeVisible();
  await button(page, 'run.won').click();
  // The other tab follows without a reload, and says why its screen changed.
  await expect(other.getByText(message('set.conquered'), { exact: true })).toBeVisible();
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
    await expect(button(page, 'run.won').or(button(page, 'run.next'))).toBeVisible();
    expect((await strip.innerText()).trim()).toBe(shown);
  };
  await expect(button(page, 'run.won')).toBeVisible();
  await button(page, 'run.lost').click();
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 1 }) })).toBeVisible();
  await freshly();
  await button(page, 'run.undo').click();
  await expect(page.getByRole('list', { name: message('run.lives', { lives: 2 }) })).toBeVisible();
  await freshly();
  await button(page, 'run.lost').click();
  await button(page, 'run.lost').click();
  await expect(page.getByText(message('run.resets', { resets: 1 }), { exact: true })).toBeVisible();
  await expect(page.getByText(message('run.resetNotice'))).toBeVisible();
  await freshly();
});
