import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { nextSet, reportLoss, reportWin, startRun, undo, type RunState } from './engine';
import { cryptoSource } from './random';

const item = (id: string) => ({ id, name: { 'en-US': id }, image: `${id}.png` });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', 160).map(item),
  gear: {
    head: ids('H', 160).map(item),
    clothes: ids('C', 160).map(item),
    shoes: ids('S', 160).map(item),
  },
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const t0 = '2026-10-24T12:00:00.000Z';
const t1 = '2026-10-25T09:30:00.000Z';
const start = () => startRun(catalogue, { name: undefined }, cryptoSource, t0);
const win = (s: RunState, at = t1) => reportWin(s, { step: s.step, at });
const lose = (s: RunState, at = t1) => reportLoss(s, { step: s.step, at });
const next = (s: RunState) => nextSet(s, { step: s.step });
const winAndNext = (s: RunState, n: number) => {
  for (let i = 0; i < n; i++) s = next(win(s));
  return s;
};

describe('the run log (FR-24)', () => {
  it('starts empty, complete from the start of a run begun in format 2', () => {
    expect(start()).toMatchObject({ schema: 2, log: [], logSince: t0 });
  });

  it('logs a win: the draw, the result, the lives after it, and when', () => {
    expect(win(start()).log).toEqual([
      {
        at: t1,
        draw: 0,
        result: 'win',
        livesAfter: 1,
        conqueredAfter: 1,
        replay: false,
        reset: false,
      },
    ]);
  });

  it('logs the life a tenth win earned as part of that win', () => {
    expect(win(winAndNext(start(), 9)).log.at(-1)).toMatchObject({
      draw: 9,
      result: 'win',
      livesAfter: 2,
    });
  });

  it('logs a loss with the lives it left, and a reset where it happened', () => {
    const twoLives = winAndNext(start(), 12);
    const lost = lose(twoLives);
    expect(lost.log.at(-1)).toEqual({
      at: t1,
      draw: 12,
      result: 'loss',
      livesAfter: 1,
      conqueredAfter: 12,
      replay: false,
      reset: false,
    });
    expect(lose(lost).log.at(-1)).toMatchObject({
      draw: 12,
      result: 'loss',
      livesAfter: 1,
      reset: true,
    });
  });

  it('marks a replayed set as a replay', () => {
    const reset = lose(lose(winAndNext(start(), 12)));
    expect(win(reset).log.at(-1)).toMatchObject({ draw: 0, result: 'win', replay: true });
  });

  it('does not log asking for the next set', () => {
    const s = win(start());
    expect(next(s).log).toEqual(s.log);
  });

  it('loses the entry of an undone result, and only that one (FR-20)', () => {
    const s = winAndNext(start(), 3);
    expect(undo(win(s)).log).toEqual(s.log);
    expect(undo(next(win(s))).log).toEqual(s.log);
    expect(undo(lose(s)).log).toEqual(s.log);
  });

  it('keeps no second copy of the log for undo, so a long run stays small (failure 3)', () => {
    let s = start();
    for (let n = 0; n < 2000; n++) {
      s = n % 3 === 2 ? lose(s) : win(s);
      if (s.phase === 'conquered' && s.cursor + 1 < s.order.kits.length) s = next(s);
    }
    expect(s.previous && 'log' in s.previous).toBe(false);
    expect(JSON.stringify(s).length).toBeLessThan(500_000);
  });

  it('always agrees with the run, over random walks (failure 2)', () => {
    const r = new Uint32Array(1);
    for (let trial = 0; trial < 60; trial++) {
      let s = start();
      for (let step = 0; step < 150; step++) {
        crypto.getRandomValues(r);
        const choice = (r[0] ?? 0) % 5;
        try {
          s = choice < 2 ? win(s) : choice === 2 ? lose(s) : choice === 3 ? next(s) : undo(s);
        } catch {
          continue;
        }
        expect(s.log).toHaveLength(s.matches);
        if (s.log.length)
          expect(s.log.at(-1)).toMatchObject({ livesAfter: s.lives, conqueredAfter: s.conquered });
        expect(s.log.every((e) => e.draw >= 0 && e.draw < s.order.kits.length)).toBe(true);
      }
    }
  });
});
