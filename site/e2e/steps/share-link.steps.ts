import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import type { Catalogue } from '../../src/catalogue/types';
import { decodeShare } from '../../src/share/link';
import { Given, Then, When } from '../fixtures';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';

const messages = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) => {
  const text = messages[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, 'en-US').format(values));
};
const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const button = (p: Page, id: string) => p.getByRole('button', { name: message(id) });

// Copies the link the way a player does, and reads it back from the clipboard.
async function copyLink(p: Page): Promise<string> {
  await p.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await button(p, 'share.copy').click();
  await expect(p.getByRole('status').filter({ hasText: message('share.copied') })).toBeVisible();
  return p.evaluate(() => navigator.clipboard.readText());
}

// The link opened where a stranger would open it: a browser with no run of its own.
async function openElsewhere(p: Page, link: string) {
  const browser = p.context().browser();
  if (!browser) throw new Error('steps: no browser to open the link in');
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other.getByRole('heading', { level: 1 })).toBeVisible();
  return other;
}

When('the player copies the link to the run', async ({ page, world }) => {
  world.link = await copyLink(page);
});

When('a player copies the link to the run', async ({ page, world }) => {
  await seedRun(page, playRun(winsThenPlaying(4), 'Inkling Ivo'));
  world.link = await copyLink(page);
});

Then("the link is on the player's clipboard", async ({ page, baseURL, world }) => {
  const link = world.link as string;
  expect(link.startsWith(`${baseURL}en-US/run/#`)).toBe(true);
  // The link opens the run it was copied from (failure 2).
  const other = await openElsewhere(page, link);
  await expect(other.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: 0, total: 160 }),
  );
});

Then(
  'the player is told, in words and to a screen reader, that it was copied',
  async ({ page }) => {
    const told = page.getByRole('status').filter({ hasText: message('share.copied') });
    await expect(told).toBeVisible();
    await expect(told).toHaveAttribute('aria-live', 'polite');
  },
);

Given('a player on a device that offers a share sheet', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      value: (data: ShareData) => {
        (window as unknown as { shared: ShareData[] }).shared = [
          ...((window as unknown as { shared?: ShareData[] }).shared ?? []),
          data,
        ];
        return Promise.resolve();
      },
    });
  });
  await seedRun(page, playRun(winsThenPlaying(2)));
});

When('the player shares the run', async ({ page }) => {
  await button(page, 'share.share').click();
});

Then("the device's share sheet opens with the link to the run", async ({ page, baseURL }) => {
  const shared = await page.evaluate(
    () => (window as unknown as { shared?: ShareData[] }).shared ?? [],
  );
  expect(shared).toHaveLength(1);
  expect(shared[0]?.url?.startsWith(`${baseURL}en-US/run/#`)).toBe(true);
  const other = await openElsewhere(page, shared[0]?.url ?? '');
  await expect(other.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: 2, total: 160 }),
  );
});

Then('the run is carried in the part of the link after "#"', async ({ world }) => {
  const url = new URL(world.link as string);
  expect(url.pathname.endsWith('/en-US/run/')).toBe(true);
  expect(decodeShare(url.hash.slice(1), { '11.3.0': catalogue })).toMatchObject({
    ok: true,
    run: { name: 'Inkling Ivo', conquered: 4 },
  });
});

Then('the link has no query string', async ({ world }) => {
  expect(new URL(world.link as string).search).toBe('');
});

Given(
  'a complete run of {int} kits with a display name of {int} characters',
  async ({ page }, kits: number, length: number) => {
    // Characters as the player sees them, an emoji among them, as the name field counts them.
    const count = (s: string) => [...new Intl.Segmenter().segment(s)].length;
    let name = 'Iñigo, Ñandú 🦑 ';
    while (count(name) < length) name += 'é';
    expect(count(name)).toBe(length);
    // The last win ends the run: there is no next set after it.
    const state = playRun([...winsThenPlaying(kits - 1), 'win'], name);
    expect(state.conquered).toBe(kits);
    await seedRun(page, state);
  },
);

Then('the link is at most {int} characters long', async ({ world }, max: number) => {
  expect((world.link as string).length).toBeLessThanOrEqual(max);
});

Given(
  'a player copied the link to their run with {int} kits conquered',
  async ({ page, world }, conquered: number) => {
    await seedRun(page, playRun(winsThenPlaying(conquered)));
    world.link = await copyLink(page);
  },
);

When('the player wins three more matches', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await button(page, 'run.won').click();
    await button(page, 'run.next').click();
  }
  await expect(page.locator('.run-conquered')).toHaveText(
    message('run.conquered', { conquered: 15, total: 160 }),
  );
});

Then(
  'the link they copied still shows {int} kits conquered',
  async ({ page, world }, conquered: number) => {
    const other = await openElsewhere(page, world.link as string);
    await expect(other.locator('.run-conquered')).toHaveText(
      message('run.conquered', { conquered, total: 160 }),
    );
  },
);
