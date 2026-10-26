import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import type { Catalogue, NamesFile } from '../../src/catalogue/types';
import { messageIn } from './messages';

// The six modes, as the en-US page names them, in the order the site offers them (match-modes).
const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;
const english = (
  JSON.parse(readFileSync('src/catalogue/11.3.0/names/en-US.json', 'utf8')) as NamesFile
).names;
export const modes = catalogue.modes.map((m) => ({ id: m.id, name: english[m.id] ?? m.id }));
export const modeName = (id: string) => english[id] ?? id;

// The dialog that asks for the mode of a result.
export const modeDialog = (p: Page, result: 'win' | 'loss') =>
  p.getByRole('dialog', {
    name: messageIn('en-US', result === 'win' ? 'mode.titleWin' : 'mode.titleLoss'),
  });

// Moves focus with Tab alone until it reaches the target, as a keyboard user would.
export async function tabTo(p: Page, target: Locator) {
  for (let i = 0; i < 200 && !(await target.evaluate((e) => e === document.activeElement)); i++)
    await p.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

// Opens the choice of mode for a result: "I won" or "I lost", clicked, or reached with Tab and
// pressed with Enter.
export async function askForMode(
  p: Page,
  result: 'win' | 'loss',
  { keyboard = false }: { keyboard?: boolean } = {},
) {
  const button = p.getByRole('button', {
    name: messageIn('en-US', result === 'win' ? 'run.won' : 'run.lost'),
  });
  if (keyboard) {
    await tabTo(p, button);
    await p.keyboard.press('Enter');
  } else {
    await button.click();
  }
  await expect(modeDialog(p, result)).toBeVisible();
}

// Chooses the mode in the open dialog, which records the result.
export async function chooseMode(p: Page, result: 'win' | 'loss', mode = modes[0]?.name ?? '') {
  await modeDialog(p, result).getByRole('button', { name: mode, exact: true }).click();
  await expect(modeDialog(p, result)).toBeHidden();
}

// A whole report: the result, in a mode (Turf War unless a scenario names one).
export async function report(p: Page, result: 'win' | 'loss', mode?: string) {
  await askForMode(p, result);
  await chooseMode(p, result, mode);
}
