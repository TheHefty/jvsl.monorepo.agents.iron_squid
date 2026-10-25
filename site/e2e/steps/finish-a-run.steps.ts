import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { IntlMessageFormat } from 'intl-messageformat';
import { Given, Then, When } from '../fixtures';
import { playRun, seedRun, winsThenPlaying } from '../support/seed';

const catalogue = JSON.parse(readFileSync('src/i18n/messages/en-US.json', 'utf8')) as Record<
  string,
  string
>;
const message = (id: string, values: Record<string, unknown> = {}) => {
  const text = catalogue[id];
  if (text === undefined) throw new Error(`steps: en-US catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, 'en-US').format(values));
};
const button = (p: Page, id: string) => p.getByRole('button', { name: message(id) });
const complete = (p: Page) => p.getByRole('heading', { name: message('finish.title') });

// One kit from the end: 159 conquered, playing the last.
const oneToGo = () => playRun(winsThenPlaying(159));

Given(
  'a player with {int} of {int} kits conquered',
  async ({ page }, conquered: number, total: number) => {
    const state = oneToGo();
    expect([state.conquered, state.order.kits.length]).toEqual([conquered, total]);
    await seedRun(page, state);
  },
);

When('the player reports a win with the last kit', async ({ page }) => {
  await button(page, 'run.won').click();
});

Then('the player is told the run is complete', async ({ page }) => {
  await expect(complete(page)).toBeVisible();
});

Then('the player is shown how many matches, wins, losses and resets it took', async ({ page }) => {
  await expect(
    page.getByText(message('finish.summary', { matches: 160, wins: 160, losses: 0, resets: 0 })),
  ).toBeVisible();
});

Given('a complete run', async ({ page }) => {
  await seedRun(page, playRun([...winsThenPlaying(159), 'win']));
  await expect(complete(page)).toBeVisible();
});

Then('the player is not offered a next set', async ({ page }) => {
  await expect(button(page, 'run.next')).toHaveCount(0);
  await expect(button(page, 'run.won')).toHaveCount(0);
  await expect(button(page, 'run.lost')).toHaveCount(0);
});

Then('the player can start a new run', async ({ page }) => {
  await expect(button(page, 'run.newRun')).toBeVisible();
});

Then('the run is still shown as complete', async ({ page }) => {
  await expect(complete(page)).toBeVisible();
});

Given('a player has just completed the run', async ({ page }) => {
  await seedRun(page, oneToGo());
  await button(page, 'run.won').click();
  await expect(complete(page)).toBeVisible();
});

When('the player undoes the last win', async ({ page }) => {
  await button(page, 'run.undo').click();
});

Then('the run is no longer complete', async ({ page }) => {
  await expect(complete(page)).toHaveCount(0);
});

Then('the player is playing the last kit again', async ({ page }) => {
  await expect(button(page, 'run.won')).toBeVisible();
  await expect(
    page.getByText(message('set.weaponNumber', { number: 160, total: 160 })),
  ).toBeVisible();
});

// The screen-reader player of the shared step, brought one kit from the end of a run.
When('the player completes the run', async ({ page }) => {
  await page.evaluate(
    (record) => localStorage.setItem('iron-squid:run', record),
    JSON.stringify({ revision: 1, state: oneToGo() }),
  );
  await page.reload();
  await button(page, 'run.won').click();
});

Then('the screen reader announces that the run is complete', async ({ page }) => {
  await expect(page.locator('[aria-live="polite"]')).toHaveText(message('finish.announce'));
});
