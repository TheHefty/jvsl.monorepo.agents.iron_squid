import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import {
  isReplay,
  replaysRemaining,
  reportLoss,
  reportWin,
  startRun,
  type RunState,
} from './engine';
import { cryptoSource } from './random';

const item = (id: string) => ({ id, name: { 'en-US': id }, image: `${id}.png` });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', 20).map(item),
  gear: {
    head: ids('H', 20).map(item),
    clothes: ids('C', 20).map(item),
    shoes: ids('S', 20).map(item),
  },
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const at = '2026-10-25T12:00:00.000Z';
const win = (s: RunState) => reportWin(s, { step: s.step, at, mode: 'Pnt' });
const lose = (s: RunState) => reportLoss(s, { step: s.step, at, mode: 'Pnt' });
const winTimes = (s: RunState, n: number) => {
  for (let i = 0; i < n; i++) s = win(s);
  return s;
};
// 12 conquered, then two losses: the 12 wins earned a second life, so the second loss resets.
const afterReset = () =>
  lose(lose(winTimes(startRun(catalogue, { name: undefined }, cryptoSource, at), 12)));

describe('a replay (FR-19)', () => {
  it('is a set already conquered, played again after a reset', () => {
    const s = afterReset();
    expect(isReplay(s)).toBe(true);
    expect(replaysRemaining(s)).toBe(12);
  });

  it('counts the set on screen: playing the fifth of 12, 8 remain', () => {
    expect(replaysRemaining(winTimes(afterReset(), 4))).toBe(8);
  });

  it('on the last of 12, 1 remains; after it is won, the next set is a new draw', () => {
    const last = winTimes(afterReset(), 11);
    expect(replaysRemaining(last)).toBe(1);
    const fresh = win(last);
    expect(isReplay(fresh)).toBe(false);
    expect(replaysRemaining(fresh)).toBe(0);
  });

  it('is never a new draw, nor the set just conquered by a new win', () => {
    const s = winTimes(startRun(catalogue, { name: undefined }, cryptoSource, at), 3);
    expect(isReplay(s)).toBe(false);
    expect(isReplay(win(s))).toBe(false);
  });

  it('moves on from a replay just won to the next replay (match-modes)', () => {
    const s = win(afterReset());
    expect(isReplay(s)).toBe(true);
    expect(replaysRemaining(s)).toBe(11);
  });
});
