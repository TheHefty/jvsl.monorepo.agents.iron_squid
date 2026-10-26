// Runs for scenarios that start mid-run ("9 wins since the run started"), built by playing the
// engine's own actions on the real catalogue and nothing else, so a scenario never starts from a
// state the site could not have reached (task report-screen, failure 1).
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Catalogue, NamesFile } from '../../src/catalogue/types';
import { reportLoss, reportWin, startRun, type RunState } from '../../src/run/engine';
import { cryptoSource } from '../../src/run/random';

const catalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;

export type Play = 'win' | 'loss';
// In the past, as a real run's start always is: a run dated after the clock would make a log that
// began on the day it was migrated look older than the run itself.
const at = '2026-10-20T12:00:00.000Z';

// `when` dates the results (the run log shows them); by default every result is dated `at`. Every
// result is played in `mode` (Turf War by default); null makes a run from before modes were
// recorded, whose log entries carry none (match-modes).
export function playRun(
  plays: Play[],
  name?: string,
  when: string = at,
  mode: string | null = 'Pnt',
): RunState {
  let s = startRun(catalogue, { name }, cryptoSource, at);
  for (const play of plays) {
    const action = { step: s.step, at: when, mode: mode ?? 'Pnt' };
    s = play === 'win' ? reportWin(s, action) : reportLoss(s, action);
  }
  if (mode === null)
    s = { ...s, log: s.log.map(({ mode: _mode, ...entry }) => (void _mode, entry)) };
  return s;
}

// n wins: a win draws the next set at once, so the player is then playing a new set.
export const winsThenPlaying = (n: number): Play[] => Array.from({ length: n }, () => 'win');

// Writes the run into the page's storage before its first load, once: a reload keeps what the
// player did since.
export async function seedRunScript(page: Page, state: RunState) {
  await page.addInitScript(
    (record) => {
      if (!sessionStorage.getItem('iron-squid:seeded')) {
        localStorage.setItem('iron-squid:run', record);
        sessionStorage.setItem('iron-squid:seeded', '1');
      }
    },
    JSON.stringify({ revision: 1, state }),
  );
}

export async function seedRun(page: Page, state: RunState, locale = 'en-US') {
  await seedRunScript(page, state);
  await page.goto(`./${locale}/`);
}

// The names of draw n of a run, kit first, as the set card shows them in en-US.
const english = (
  JSON.parse(readFileSync('src/catalogue/11.3.0/names/en-US.json', 'utf8')) as NamesFile
).names;
export function setNames(state: RunState, n: number): string[] {
  const name = (id: string | undefined) => english[id ?? ''] ?? `<no item ${String(id)}>`;
  return [
    name(state.order.kits[n]),
    name(state.order.head[n]),
    name(state.order.clothes[n]),
    name(state.order.shoes[n]),
  ];
}
