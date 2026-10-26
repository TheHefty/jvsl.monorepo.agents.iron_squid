import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { isComplete, reportLoss, reportWin, startRun, totals, undo, type RunState } from './engine';
import { parseRun } from './parse';
import { cryptoSource } from './random';

const item = (id: string) => ({ id, name: { 'en-US': id }, image: `${id}.png` });
// Every piece wears a brand (gear-brand); which one does not matter to the rules.
const piece = (id: string) => ({ ...item(id), brand: 'B00' });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', 12).map(item),
  gear: {
    head: ids('H', 12).map(piece),
    clothes: ids('C', 12).map(piece),
    shoes: ids('S', 12).map(piece),
  },
  brands: [{ id: 'B00', image: 'brand/B00.png' }],
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const at = '2026-10-25T12:00:00.000Z';
const start = () => startRun(catalogue, { name: undefined }, cryptoSource, at);
const win = (s: RunState) => reportWin(s, { step: s.step, at, mode: 'Pnt' });
const lose = (s: RunState) => reportLoss(s, { step: s.step, at, mode: 'Pnt' });
const winTimes = (s: RunState, n: number) => {
  for (let i = 0; i < n; i++) s = win(s);
  return s;
};

describe('the end of a run (FR-21)', () => {
  it('comes with the last kit conquered, and not a win before', () => {
    const last = winTimes(start(), 11);
    expect(isComplete(last)).toBe(false);
    expect(isComplete(win(last))).toBe(true);
  });

  it('does not come on a replay, however far the cursor goes', () => {
    // 11 conquered, reset, then all 11 replayed: the cursor reaches the twelfth draw, still not won.
    let s = lose(lose(winTimes(start(), 11)));
    s = winTimes(s, 11);
    expect(s.conquered).toBe(11);
    expect(isComplete(s)).toBe(false);
    expect(isComplete(win(s))).toBe(true);
  });

  it('takes no more results: no win, no loss', () => {
    const done = win(winTimes(start(), 11));
    expect(() => win(done)).toThrow();
    expect(() => lose(done)).toThrow();
  });

  it('is undone with the final win, and the last kit is played again', () => {
    const last = winTimes(start(), 11);
    const back = undo(win(last));
    expect(isComplete(back)).toBe(false);
    expect(back.phase).toBe('playing');
    expect(back.cursor).toBe(last.cursor);
  });
});

describe('totals', () => {
  it('counts matches, wins, losses and resets over the whole run', () => {
    // 11 wins (the tenth earns a second life); two losses spend it and reset; 2 replay wins.
    const s = winTimes(lose(lose(winTimes(start(), 11))), 2);
    expect(totals(s)).toEqual({ matches: 15, wins: 13, losses: 2, resets: 1, since: undefined });
  });

  it('says from when wins and losses were counted, for a run whose log starts part-way', () => {
    const played = winTimes(start(), 3);
    const { log: _log, logSince: _since, previous, ...v1 } = played;
    void _log;
    void _since;
    const migrated = parseRun(
      { ...v1, schema: 1, ...(previous ? { previous: { ...previous, schema: 1 } } : {}) },
      { '11.3.0': catalogue },
      '2026-10-26T09:00:00.000Z',
    );
    if (!migrated.ok) throw new Error(migrated.detail);
    const after = win(migrated.state);
    expect(totals(after)).toEqual({
      matches: 4,
      wins: 1,
      losses: 0,
      resets: 0,
      since: '2026-10-26T09:00:00.000Z',
    });
  });
});
