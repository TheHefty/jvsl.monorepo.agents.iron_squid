import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import {
  currentSet,
  nextSet,
  reportLoss,
  reportWin,
  startRun,
  undo,
  winsToNextLife,
  type RunState,
} from './engine';
import { cryptoSource } from './random';

const item = (id: string) => ({ id, name: { 'en-US': id }, image: `${id}.png` });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', 40).map(item),
  gear: {
    head: ids('H', 40).map(item),
    clothes: ids('C', 40).map(item),
    shoes: ids('S', 40).map(item),
  },
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const at = '2026-10-25T12:00:00.000Z';
const start = () => startRun(catalogue, { name: undefined }, cryptoSource, at);
const win = (s: RunState) => reportWin(s, { step: s.step, at });
const lose = (s: RunState) => reportLoss(s, { step: s.step, at });
const next = (s: RunState) => nextSet(s, { step: s.step });
const winAndNext = (s: RunState, times: number) => {
  for (let i = 0; i < times; i++) s = next(win(s));
  return s;
};
// The run itself, without the step counter and the one-level undo history: what FR-20 restores.
const run = ({ step: _step, previous: _previous, ...rest }: RunState) => {
  void _step;
  void _previous;
  return rest;
};

describe('lives from wins (FR-16)', () => {
  it.each([
    [9, 1],
    [10, 2],
    [11, 2],
    [19, 2],
    [20, 3],
  ])('after %i wins since the run started, the player has %i lives', (wins, lives) => {
    let s = winAndNext(start(), wins - 1);
    s = win(s);
    expect(s.lives).toBe(lives);
  });

  it('says how many wins earn the next life', () => {
    expect(winsToNextLife(start())).toBe(10);
    expect(winsToNextLife(win(winAndNext(start(), 12)))).toBe(7);
  });
});

describe('a loss with lives to spare (FR-17)', () => {
  it('costs one life, and the same set is played again', () => {
    let s = win(winAndNext(start(), 9)); // 10 wins: 2 lives
    s = next(s);
    const set = currentSet(s);
    const lost = lose(s);
    expect(lost).toMatchObject({ lives: 1, phase: 'playing', matches: s.matches + 1, resets: 0 });
    expect(currentSet(lost)).toEqual(set);
  });
});

describe('a loss on the last life resets the run (FR-18)', () => {
  it('goes back to the first conquered set, with 1 life, and keeps what was conquered', () => {
    // 12 wins earn a second life; one loss spends it, so the player has 12 conquered and 1 life.
    const s = lose(winAndNext(start(), 12));
    expect(s.lives).toBe(1);
    const reset = lose(s);
    expect(reset).toMatchObject({
      cursor: 0,
      lives: 1,
      winsSinceReset: 0,
      resets: 1,
      conquered: 12,
    });
    expect(currentSet(reset)).toEqual({
      kit: s.order.kits[0],
      head: s.order.head[0],
      clothes: s.order.clothes[0],
      shoes: s.order.shoes[0],
    });
  });

  it('replays the conquered sets in order without conquering them again, then draws anew', () => {
    let s = lose(winAndNext(start(), 3));
    for (let i = 0; i < 3; i++) {
      expect(currentSet(s).kit).toBe(s.order.kits[i]);
      s = win(s);
      expect(s.conquered).toBe(3);
      s = next(s);
    }
    expect(s.cursor).toBe(3);
    expect(currentSet(s).kit).toBe(s.order.kits[3]);
    expect(win(s).conquered).toBe(4);
  });

  it('counts replay wins towards the next life', () => {
    let s = lose(lose(winAndNext(start(), 12)));
    expect(s.resets).toBe(1);
    s = winAndNext(s, 9);
    expect(win(s).lives).toBe(2);
  });

  it('with nothing conquered, counts the reset and plays the same set', () => {
    const s = start();
    const reset = lose(s);
    expect(reset).toMatchObject({ resets: 1, lives: 1, cursor: 0, conquered: 0 });
    expect(currentSet(reset)).toEqual(currentSet(s));
  });
});

describe('undo across losses (FR-20)', () => {
  it('undoes a loss exactly', () => {
    const s = next(win(winAndNext(start(), 9)));
    expect(run(undo(lose(s)))).toEqual(run(s));
  });

  it('undoes the loss that caused a reset exactly, resets included', () => {
    const s = winAndNext(start(), 5);
    expect(run(undo(lose(s)))).toEqual(run(s));
  });

  it('takes back the life a tenth win earned', () => {
    const s = winAndNext(start(), 9);
    const tenth = win(s);
    expect(tenth.lives).toBe(2);
    expect(undo(tenth).lives).toBe(1);
  });

  it('allows only the last result to be undone', () => {
    const twoLives = next(win(winAndNext(start(), 9)));
    const back = undo(lose(twoLives));
    expect(() => undo(back)).toThrow(/nothing to undo/);
  });
});

describe('every walk keeps the rules (property)', () => {
  it('lives always equal 1 + wins/10 − losses since the last reset; conquered never drops', () => {
    const r = new Uint32Array(1);
    for (let trial = 0; trial < 100; trial++) {
      let s = start();
      // What the test expects, kept beside the run, with one level of history for undo.
      let losses = 0;
      let history: { losses: number } | undefined;
      for (let step = 0; step < 120; step++) {
        crypto.getRandomValues(r);
        const choice = (r[0] ?? 0) % 6;
        const before = s;
        try {
          if (choice < 2) s = win(s);
          else if (choice === 2) s = lose(s);
          else if (choice < 5) s = next(s);
          else s = undo(s);
        } catch {
          continue;
        }
        if (choice < 2 || choice === 2) {
          history = { losses };
          if (choice === 2) losses = before.lives > 1 ? losses + 1 : 0;
        } else if (choice === 5) {
          losses = history?.losses ?? losses;
          history = undefined;
        }
        expect(s.lives).toBeGreaterThanOrEqual(1);
        expect(s.lives).toBe(1 + Math.floor(s.winsSinceReset / 10) - losses);
        expect(s.cursor).toBeLessThanOrEqual(s.conquered);
        if (choice !== 5) expect(s.conquered).toBeGreaterThanOrEqual(before.conquered);
      }
    }
  });
});
