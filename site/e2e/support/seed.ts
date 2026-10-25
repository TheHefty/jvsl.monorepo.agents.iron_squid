// Runs for scenarios that start mid-run ("9 wins since the run started"), built by playing the
// engine's own actions on the real catalogue and nothing else, so a scenario never starts from a
// state the site could not have reached (task report-screen, failure 1).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import { nextSet, reportLoss, reportWin, startRun, type RunState } from '../../src/run/engine';
import { cryptoSource } from '../../src/run/random';

const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;

export type Play = 'win' | 'loss' | 'next';
const at = '2026-10-25T12:00:00.000Z';

export function playRun(plays: Play[], name?: string): RunState {
  let s = startRun(catalogue, { name }, cryptoSource, at);
  for (const play of plays) {
    if (play === 'win') s = reportWin(s, { step: s.step, at });
    else if (play === 'loss') s = reportLoss(s, { step: s.step, at });
    else s = nextSet(s, { step: s.step });
  }
  return s;
}

// n wins, each followed by the next set: the player is then playing a new set.
export const winsThenPlaying = (n: number): Play[] =>
  Array.from({ length: n }, () => ['win', 'next'] as Play[]).flat();

// Writes the run into the page's storage before its first load, once: a reload keeps what the
// player did since.
export async function seedRun(page: Page, state: RunState) {
  await page.addInitScript(
    (record) => {
      if (!sessionStorage.getItem('iron-squid:seeded')) {
        localStorage.setItem('iron-squid:run', record);
        sessionStorage.setItem('iron-squid:seeded', '1');
      }
    },
    JSON.stringify({ revision: 1, state }),
  );
  await page.goto('./en-US/');
}
