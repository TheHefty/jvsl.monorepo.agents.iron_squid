import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import {
  currentSet,
  isComplete,
  reportLoss,
  reportWin,
  startRun,
  undo,
  type RunState,
} from './engine';
import { parseRun } from './parse';
import { cryptoSource } from './random';

// The rules of match-modes (FR-15, FR-23, FR-24 as amended): every result names its mode, and a win
// moves straight on to the next set.
const item = (id: string) => ({ id, image: `${id}.png` });
// Every piece wears a brand (gear-brand); which one does not matter to the rules.
const piece = (id: string) => ({ ...item(id), brand: 'B00' });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '0.0.1',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1' },
  kits: ids('K', 3).map(item),
  gear: {
    head: ids('H', 3).map(piece),
    clothes: ids('C', 3).map(piece),
    shoes: ids('S', 3).map(piece),
  },
  brands: [{ id: 'B00', image: 'brand/B00.png' }],
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const at = '2026-10-24T12:00:00.000Z';
const start = () => startRun(catalogue, { name: undefined }, cryptoSource, at);
const win = (s: RunState, mode = 'Pnt') => reportWin(s, { step: s.step, at, mode });
const lose = (s: RunState, mode = 'Pnt') => reportLoss(s, { step: s.step, at, mode });

describe('a result in a mode', () => {
  it('is refused without a mode (report-with-mode, failure 1)', () => {
    const s = start();
    expect(() => reportWin(s, { step: s.step, at, mode: '' })).toThrow(/mode/);
    expect(() => reportLoss(s, { step: s.step, at, mode: '' })).toThrow(/mode/);
  });

  it('records the mode of a win, and moves straight on to the next set', () => {
    const s = win(start(), 'Vlf');
    expect(s).toMatchObject({ conquered: 1, cursor: 1, phase: 'playing' });
    expect(s.log.at(-1)).toMatchObject({ result: 'win', mode: 'Vlf', draw: 0 });
    expect(currentSet(s).kit).toBe(s.order.kits[1]);
  });

  it('records the mode of a loss, and the same set is played again', () => {
    const s = lose(win(win(start())), 'Vgl');
    expect(s.log.at(-1)).toMatchObject({ result: 'loss', mode: 'Vgl' });
  });

  it('ends the run on the last win, with nothing more drawn', () => {
    const s = win(win(win(start())));
    expect(isComplete(s)).toBe(true);
    expect(s).toMatchObject({ conquered: 3, cursor: 2, phase: 'conquered' });
  });

  it('undoes a win back to the set it was won with, not yet conquered', () => {
    const before = win(start());
    const after = undo(win(before, 'Pnt'));
    expect(after).toMatchObject({ conquered: 1, cursor: 1, phase: 'playing' });
    expect(after.log).toHaveLength(1);
  });

  it('leads to the same next set when a win is undone and reported again in another mode', () => {
    const s = start();
    const first = win(s, 'Pnt');
    const again = win(undo(first), 'Vgl');
    expect(currentSet(again)).toEqual(currentSet(first));
  });
});

describe('a run from before modes', () => {
  const stored = (s: RunState) => JSON.parse(JSON.stringify(s)) as unknown;
  const catalogues = { '0.0.1': catalogue };

  it('keeps its results without a mode, and refuses a mode the catalogue does not have', () => {
    const s = win(start());
    const old = stored(s) as { log: { mode?: string }[] };
    delete old.log[0]?.mode;
    expect(parseRun(old, catalogues)).toMatchObject({ ok: true });
    (old.log[0] as { mode?: string }).mode = 'Xyz';
    expect(parseRun(old, catalogues)).toMatchObject({ ok: false });
  });

  it('left on a conquered set, loads with its next set drawn, from the order it holds (failure 2)', () => {
    const s = win(start());
    const old = { ...(stored(s) as RunState), cursor: 0, phase: 'conquered' as const };
    const parsed = parseRun(old, catalogues);
    expect(parsed).toMatchObject({
      ok: true,
      state: { cursor: 1, phase: 'playing', conquered: 1 },
    });
  });

  it('complete, stays complete', () => {
    const s = win(win(win(start())));
    expect(parseRun(stored(s), catalogues)).toMatchObject({
      ok: true,
      state: { phase: 'conquered' },
    });
  });
});
