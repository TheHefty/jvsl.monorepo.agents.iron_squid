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
// In the past, as a real run's start always is: a run dated after the clock would make a log that
// began on the day it was migrated look older than the run itself.
const at = '2026-10-20T12:00:00.000Z';

// `when` dates the results (the run log shows them); by default every result is dated `at`.
export function playRun(plays: Play[], name?: string, when: string = at): RunState {
  let s = startRun(catalogue, { name }, cryptoSource, at);
  for (const play of plays) {
    if (play === 'win') s = reportWin(s, { step: s.step, at: when });
    else if (play === 'loss') s = reportLoss(s, { step: s.step, at: when });
    else s = nextSet(s, { step: s.step });
  }
  return s;
}

// n wins, each followed by the next set: the player is then playing a new set.
export const winsThenPlaying = (n: number): Play[] =>
  Array.from({ length: n }, () => ['win', 'next'] as Play[]).flat();

// Writes the run into the page's storage before its first load, once: a reload keeps what the
// player did since.
// Puts the run in the browser's storage before the page's own scripts run, once per tab.
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

export async function seedRun(page: Page, state: RunState) {
  await seedRunScript(page, state);
  await page.goto('./en-US/');
}

// The names of draw n of a run, kit first, as the set card shows them in en-US.
export function setNames(state: RunState, n: number): string[] {
  const name = (items: { id: string; name: Record<string, string> }[], id: string | undefined) =>
    items.find((i) => i.id === id)?.name['en-US'] ?? `<no item ${String(id)}>`;
  return [
    name(catalogue.kits, state.order.kits[n]),
    name(catalogue.gear.head, state.order.head[n]),
    name(catalogue.gear.clothes, state.order.clothes[n]),
    name(catalogue.gear.shoes, state.order.shoes[n]),
  ];
}
