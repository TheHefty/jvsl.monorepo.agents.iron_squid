import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { Given, Then, When, type World } from '../fixtures';
import { report } from '../support/report';

const catalogue = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) => {
  const text = catalogue[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, 'en-US').format(values));
};

// The page a scenario is acting on: the one it was given, or the tab or browser it moved to.
const on = (world: World, page: Page) => world.page ?? page;

// The current set as a player using a screen reader would find it: the set's region, then each
// piece's image by its text alternative, kit first.
async function readSet(p: Page): Promise<string[]> {
  const set = p.getByRole('region', { name: message('set.label') });
  await expect(set).toBeVisible();
  const images = set.getByRole('img');
  await expect(images).toHaveCount(4);
  return images.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).alt));
}

async function startRun(p: Page, name = '') {
  await p.goto('./en-US/');
  if (name) await p.getByLabel(message('start.nameLabel')).fill(name);
  await p.getByRole('button', { name: message('start.roll') }).click();
}

// A win, in Turf War; the next set is drawn at once (match-modes).
const win = (p: Page) => report(p, 'win');
// The notice that names the set just conquered, now that the next set follows at once.
const justConquered = (p: Page) => p.locator('.just-conquered');

Given('a player with no run', async ({ page }) => {
  await page.goto('./en-US/');
  await expect(page.getByRole('button', { name: message('start.roll') })).toBeVisible();
});

When('the player starts a run', async ({ page }) => {
  await page.getByRole('button', { name: message('start.roll') }).click();
});

Then(
  'the player is shown a kit, a headgear, a clothing piece and a shoes piece',
  async ({ page }) => {
    const set = await readSet(page);
    expect(set.every((name) => name.length > 0)).toBe(true);
    // Each image is really there, not a broken icon with a name.
    const loaded = await page
      .getByRole('region', { name: message('set.label') })
      .getByRole('img')
      .evaluateAll((imgs) =>
        imgs.every(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
        ),
      );
    expect(loaded).toBe(true);
  },
);

Then('the player has {int} life', async ({ page }, lives: number) => {
  await expect(page.getByRole('list', { name: message('run.lives', { lives }) })).toBeVisible();
});

Then('{int} of {int} kits are conquered', async ({ page }, conquered: number, total: number) => {
  await expect(
    page.getByText(message('run.conquered', { conquered, total }), { exact: true }),
  ).toBeVisible();
});

Given('a player starting a run', async ({ page }) => {
  await page.goto('./en-US/');
});

When(
  'the player gives the run the display name {string}',
  async ({ page, world }, name: string) => {
    const field = page.getByLabel(message('start.nameLabel'));
    await field.fill(name);
    world.nameDescription = await field.evaluate((el) =>
      (el.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' '),
    );
    await page.getByRole('button', { name: message('start.roll') }).click();
  },
);

Then('the run is shown as {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
});

Then(
  'the player is told the name is visible to anyone who receives a link to the run',
  async ({ world }) => {
    expect(world.nameDescription).toContain(message('start.nameHint'));
  },
);

When('a player starts a run without a display name', async ({ page }) => {
  await startRun(page);
});

Then('the run starts and is played the same way', async ({ page }) => {
  const set = await readSet(page);
  await win(page);
  await expect(justConquered(page)).toContainText(set[0] ?? '');
});

When('a player enters a display name of {int} characters', async ({ page }, n: number) => {
  await page.goto('./en-US/');
  await page.getByLabel(message('start.nameLabel')).fill('a'.repeat(n));
  await page.getByRole('button', { name: message('start.roll') }).click();
});

Then(
  'the player is told the name can have at most {int} characters',
  async ({ page }, max: number) => {
    const field = page.getByLabel(message('start.nameLabel'));
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText(message('start.nameTooLong', { max, length: max + 1 })),
    ).toBeVisible();
  },
);

When('a player enters a display name of {int} family emoji', async ({ page }, n: number) => {
  // 30 characters as the player sees them, each of 25 bytes: within the count, over the byte cap.
  await page.goto('./en-US/');
  await page.getByLabel(message('start.nameLabel')).fill('👨‍👩‍👧‍👦'.repeat(n));
  await page.getByRole('button', { name: message('start.roll') }).click();
});

Then('the player is told the name is too long to fit in a link', async ({ page }) => {
  await expect(page.getByLabel(message('start.nameLabel'))).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(message('start.nameTooLongForLink'))).toBeVisible();
  await expect(page.getByRole('region', { name: message('set.label') })).toHaveCount(0);
});

Then('the run is not started until the name is shortened or removed', async ({ page }) => {
  await expect(page.getByRole('region', { name: message('set.label') })).toHaveCount(0);
  await page.getByLabel(message('start.nameLabel')).fill('a'.repeat(30));
  await page.getByRole('button', { name: message('start.roll') }).click();
  await readSet(page);
});

Given('a player with a run in progress', async ({ page, world }) => {
  await startRun(page);
  world.set = await readSet(page);
});

When('the player starts a new run', async ({ page }) => {
  await page.getByRole('button', { name: message('run.newRun') }).click();
});

Then(
  'the player is asked to confirm, and told the current run will be discarded',
  async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(message('newRun.warning'));
  },
);

When('the player declines', async ({ page }) => {
  await page
    .getByRole('dialog')
    .getByRole('button', { name: message('newRun.keep') })
    .click();
});

Then('the run in progress is unchanged', async ({ page, world }) => {
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await readSet(page)).toEqual(world.set);
});

Given('a player has been given a set', async ({ page, world }) => {
  await startRun(page);
  world.set = await readSet(page);
});

When('the player reloads the page', async ({ page }) => {
  await page.reload();
});

When('the player closes and reopens the browser', async ({ page, world, browser, baseURL }) => {
  const state = await page.context().storageState();
  await page.context().close();
  const reopened = await browser.newContext({ storageState: state, baseURL });
  world.page = await reopened.newPage();
  await world.page.goto('./en-US/');
});

When('the player opens the site in a new tab', async ({ page, world }) => {
  world.page = await page.context().newPage();
  await world.page.goto('./en-US/');
});

Then('the player is shown the same set', async ({ page, world }) => {
  expect(await readSet(on(world, page))).toEqual(world.set);
});

Given('a run with conquered sets', async ({ page, world }) => {
  await startRun(page);
  const seen: string[][] = [];
  for (let n = 0; n < 3; n++) {
    seen.push(await readSet(page));
    await win(page);
  }
  world.seen = seen;
});

When('the player is given a new set', async ({ page, world }) => {
  world.set = await readSet(page);
});

Then('its kit is not one already conquered in this run', async ({ world }) => {
  const [kit] = world.set as string[];
  expect((world.seen as string[][]).map((s) => s[0])).not.toContain(kit);
});

Then('none of its gear pieces has been drawn before in this run', async ({ world }) => {
  const gear = (world.set as string[]).slice(1);
  const before = (world.seen as string[][]).flatMap((s) => s.slice(1));
  expect(gear.filter((g) => before.includes(g))).toEqual([]);
});

Given('the player has just reported a win', async ({ page, world }) => {
  await startRun(page);
  world.set = await readSet(page);
  await win(page);
});

Then('the player is shown the set they just conquered', async ({ page, world }) => {
  await expect(justConquered(page)).toContainText((world.set as string[])[0] ?? '');
});

Then('the player is shown the next set', async ({ page, world }) => {
  await expect(page.getByRole('button', { name: message('run.won') })).toBeVisible();
  const set = await readSet(page);
  expect(set[0]).not.toBe((world.set as string[])[0]);
});

Given('the player has reported a win and been shown the next set', async ({ page, world }) => {
  await startRun(page);
  await win(page);
  world.set = await readSet(page);
});

When('the player undoes the win and reports the win again', async ({ page }) => {
  await page.getByRole('button', { name: message('run.undo') }).click();
  await win(page);
});

Then('the player is shown the same next set as before', async ({ page, world }) => {
  expect(await readSet(page)).toEqual(world.set);
});
