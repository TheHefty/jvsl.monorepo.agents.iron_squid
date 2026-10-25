import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { currentSet, nextSet, reportWin, startRun, undo, type RunState } from './engine';
import { cryptoSource, type RandomSource } from './random';

const item = (id: string) => ({ id, name: { 'en-US': id }, image: `${id}.png` });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', 5).map(item),
  gear: {
    head: ids('H', 6).map(item),
    clothes: ids('C', 5).map(item),
    shoes: ids('S', 7).map(item),
  },
  excluded: { replicas: [], unobtainable: [] },
};
const at = '2026-10-24T12:00:00.000Z';
const start = (source: RandomSource = cryptoSource) =>
  startRun(catalogue, { name: undefined }, source, at);
const win = (s: RunState) => reportWin(s, { step: s.step, at });
const next = (s: RunState) => nextSet(s, { step: s.step });

describe('startRun', () => {
  it('starts with 1 life, nothing conquered, and the first set to play', () => {
    const s = start();
    expect(s).toMatchObject({
      schema: 2,
      catalogueVersion: '11.3.0',
      lives: 1,
      conquered: 0,
      cursor: 0,
      resets: 0,
    });
    expect(s.phase).toBe('playing');
    expect(currentSet(s)).toEqual({
      kit: s.order.kits[0],
      head: s.order.head[0],
      clothes: s.order.clothes[0],
      shoes: s.order.shoes[0],
    });
  });

  it('fixes the order of every draw at the start: each slot a permutation of the catalogue', () => {
    const s = start();
    expect([...s.order.kits].sort()).toEqual(ids('K', 5).sort());
    expect([...s.order.head].sort()).toEqual(ids('H', 6).sort());
    expect([...s.order.shoes].sort()).toEqual(ids('S', 7).sort());
  });

  it('keeps the name it was given', () => {
    expect(startRun(catalogue, { name: 'Inkling Ivo' }, cryptoSource, at).name).toBe('Inkling Ivo');
  });

  it('refuses a catalogue with a gear slot smaller than its kits', () => {
    const small = { ...catalogue, gear: { ...catalogue.gear, clothes: ids('C', 4).map(item) } };
    expect(() => startRun(small, { name: undefined }, cryptoSource, at)).toThrow(
      'run: the clothes slot has 4 pieces for 5 kits',
    );
  });
});

describe('a win and the next set', () => {
  it('conquers the set, shows it, and draws the next only when asked (FR-23)', () => {
    const s0 = start();
    const s1 = win(s0);
    expect(s1).toMatchObject({ phase: 'conquered', conquered: 1, cursor: 0, matches: 1 });
    expect(currentSet(s1)).toEqual(currentSet(s0));
    const s2 = next(s1);
    expect(s2).toMatchObject({ phase: 'playing', cursor: 1 });
    expect(currentSet(s2).kit).toBe(s0.order.kits[1]);
  });

  it('never repeats a kit or a gear piece across a whole run (FR-12, FR-13)', () => {
    let s = start();
    const seen: string[] = [];
    for (let n = 0; n < 5; n++) {
      const set = currentSet(s);
      seen.push(set.kit, set.head, set.clothes, set.shoes);
      s = win(s);
      if (n < 4) s = next(s);
    }
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('refuses an action made on a state the screen no longer shows (double click, another tab)', () => {
    const s0 = start();
    const s1 = win(s0);
    expect(() => reportWin(s1, { step: s0.step, at })).toThrow(/stale/);
    expect(() => nextSet(next(s1), { step: s1.step })).toThrow(/stale/);
  });

  it('draws nothing after the last kit is conquered', () => {
    let s = start();
    for (let n = 0; n < 4; n++) s = next(win(s));
    const done = win(s);
    expect(done.conquered).toBe(5);
    expect(() => next(done)).toThrow('run: every kit is conquered; there is no next set');
  });

  it('refuses a win while the conquered set is on show, and a next set while playing', () => {
    const s0 = start();
    expect(() => next(s0)).toThrow(/not after a win/);
    expect(() => win(win(s0))).toThrow(/after a win/);
  });
});

describe('undo', () => {
  it('returns to exactly the state before the last result (FR-20)', () => {
    // Everything but the step, which keeps counting up so that a screen still showing the undone
    // result cannot act on the restored state.
    const s0 = start();
    const back = undo(win(s0));
    expect({ ...back, step: s0.step }).toEqual(s0);
    expect(back.step).toBeGreaterThan(win(s0).step);
  });

  it('is one step only: none after the next result, none on a fresh run', () => {
    const s0 = start();
    expect(() => undo(s0)).toThrow(/nothing to undo/);
    expect(() => undo(undo(win(s0)))).toThrow(/nothing to undo/);
  });

  it('never changes which set comes next, however often it is used (FR-14)', () => {
    // A long random walk of wins, nexts and undos: the n-th set played is always order[n].
    const walker = new Uint32Array(1);
    for (let trial = 0; trial < 50; trial++) {
      let s = start();
      const drawn = structuredClone(s.order);
      for (let step = 0; step < 40; step++) {
        crypto.getRandomValues(walker);
        const choice = (walker[0] ?? 0) % 3;
        try {
          if (choice === 0) s = win(s);
          else if (choice === 1) s = next(s);
          else s = undo(s);
        } catch {
          // an action the state does not allow right now: nothing happens
        }
        expect(currentSet(s).kit).toBe(s.order.kits[s.cursor]);
        expect(s.order).toEqual(drawn);
      }
    }
  });

  it('undoing and winning again leads to the same next set', () => {
    const s0 = start();
    const viaOnce = currentSet(next(win(s0)));
    const viaUndo = currentSet(next(win(undo(win(s0)))));
    expect(viaUndo).toEqual(viaOnce);
  });
});
