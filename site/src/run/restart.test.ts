import { describe, expect, it } from 'vitest';
import published from '../catalogue/11.3.0/catalogue.json';
import type { Catalogue } from '../catalogue/types';
import { decodeShare, encodeShare } from '../share/link';
import {
  currentSet,
  isComplete,
  isReplay,
  reportLoss,
  reportWin,
  reroll,
  startRun,
  undo,
  type RunState,
} from './engine';
import { parseRun } from './parse';
import { cryptoSource } from './random';
import v5 from './fixtures/run-v5.json';
import fixtureCatalogue from './fixtures/catalogue-0.0.1.json';

// The restart reset (FR-12, FR-13, FR-14, FR-18, FR-21, FR-25 as amended a second time on
// 2026-10-26): losing the last life loses every kit conquered and draws the whole run again.
const catalogue = published as Catalogue;
const catalogues = { [catalogue.version]: catalogue };
const at = '2026-10-26T12:00:00.000Z';
const start = () => startRun(catalogue, { name: 'Ivo', resetRule: 'restart' }, cryptoSource, at);
const act = (s: RunState, mode = 'Pnt') => ({ step: s.step, at, mode, source: cryptoSource });
const win = (s: RunState, mode = 'Pnt') => reportWin(s, act(s, mode));
const lose = (s: RunState) => reportLoss(s, act(s));
const wins = (s: RunState, n: number, mode = 'Pnt') => {
  for (let i = 0; i < n; i++) s = win(s, mode);
  return s;
};
// Loses until the run resets: 12 wins have earned a second life, so the first loss does not.
function reset(s: RunState): RunState {
  while (s.lives > 1) s = lose(s);
  return lose(s);
}
const sorted = (xs: string[]) => [...xs].sort();
const stored = (s: RunState) => JSON.parse(JSON.stringify(s)) as unknown;

describe('a reset that starts over (FR-18)', () => {
  it('loses every kit conquered, with 1 life, and counts the reset', () => {
    const s = reset(wins(start(), 12));
    expect(s).toMatchObject({ conquered: 0, cursor: 0, lives: 1, resets: 1, phase: 'playing' });
    expect(isReplay(s)).toBe(false);
  });

  it('draws the order of every kit and gear piece again, from the whole catalogue', () => {
    const before = wins(start(), 12);
    const after = reset(before);
    for (const list of ['kits', 'head', 'clothes', 'shoes'] as const) {
      expect(sorted(after.order[list]), list).toEqual(sorted(before.order[list]));
      // 1 in 160! (or more) that a fair draw gives the same order back.
      expect(after.order[list], list).not.toEqual(before.order[list]);
    }
    expect(currentSet(after).kit).toBe(after.order.kits[0]);
  });

  it('gives the spares back: a piece re-rolled away can be drawn again (FR-13, FR-25)', () => {
    let s = start();
    s = reroll(s, { step: s.step, at, slot: 'shoes' });
    expect(s.spent.shoes).toBe(1);
    s = reset(s);
    expect(s.spent).toEqual({ head: 0, clothes: 0, shoes: 0 });
    expect(s.worn).toEqual({ head: {}, clothes: {}, shoes: {} });
    expect(s.rerolls).toHaveLength(1);
  });

  it('cannot be drawn again by undo: the same loss brings the same draw (FR-14, failure 1)', () => {
    const first = reset(wins(start(), 12));
    const again = reset(undo(first));
    expect(again.order).toEqual(first.order);
  });

  it('over random walks of wins, losses and undos, never draws a reset twice', () => {
    const r = new Uint32Array(1);
    for (let trial = 0; trial < 20; trial++) {
      let s = wins(start(), 3);
      const seen = new Map<string, string>();
      for (let step = 0; step < 80; step++) {
        crypto.getRandomValues(r);
        const choice = (r[0] ?? 0) % 4;
        try {
          s = choice < 2 ? win(s) : choice === 2 ? lose(s) : undo(s);
        } catch {
          continue;
        }
        const key = `${s.resets}:${s.matches}`;
        if (s.resets > 0 && s.cursor === 0 && s.conquered === 0) {
          const order = s.order.kits.join();
          if (seen.has(key)) expect(order, key).toBe(seen.get(key));
          seen.set(key, order);
        }
      }
    }
  });

  it('completes only with every kit won after the last reset (FR-21)', () => {
    let s = reset(wins(start(), 12));
    s = wins(s, 159);
    expect(isComplete(s)).toBe(false);
    expect(isComplete(win(s))).toBe(true);
  });
});

describe('the log through a reset (FR-24, failure 2)', () => {
  it('keeps every match, naming the kit each was played with, before and after the reset', () => {
    let s = wins(start(), 3);
    const played = [0, 1, 2].map((n) => s.order.kits[n]);
    const lost = currentSet(s).kit;
    s = reset(s);
    const firstAfter = currentSet(s).kit;
    s = win(s);
    expect(s.log).toHaveLength(5);
    expect(s.log.map((e) => e.kit)).toEqual([...played, lost, firstAfter]);
    expect(s.log[3]).toMatchObject({ result: 'loss', reset: true });
  });
});

describe('a share link after a reset (FR-41, failure 2)', () => {
  it('shows the kits conquered since the reset, with their gear and mode, and the whole log', () => {
    let s = reset(wins(start(), 12, 'Var'));
    s = wins(s, 3, 'Vlf');
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared.ok).toBe(true);
    if (!shared.ok) return;
    expect(shared.run.conquered).toBe(3);
    expect(shared.run.sets.map((x) => x.kit)).toEqual(s.order.kits.slice(0, 3));
    expect(shared.run.sets.map((x) => x.mode)).toEqual(['Vlf', 'Vlf', 'Vlf']);
    expect(shared.run.log?.map((m) => m.kit)).toEqual(s.log.map((e) => e.kit));
  });
});

describe('storage (failure 3)', () => {
  it('keeps a run with a reset, and reads it back the same', () => {
    const s = win(reset(wins(start(), 12)));
    const parsed = parseRun(stored(s), catalogues);
    expect(parsed).toMatchObject({ ok: true, state: { resetRule: 'restart', schema: 5 } });
    if (parsed.ok) {
      expect(parsed.state.order).toEqual(s.order);
      expect(parsed.state.log).toEqual(s.log);
      // The draw each reset made is kept, so an undo after reloading cannot draw it again.
      expect(parsed.state.redraws).toEqual(s.redraws);
    }
  });

  it('refuses a redraw that is not every kit drawn once', () => {
    const run = stored(reset(wins(start(), 12))) as {
      redraws: Record<string, { order: { kits: string[] } }>;
    };
    const kits = run.redraws['1']?.order.kits;
    if (kits) kits[1] = kits[0] ?? '';
    expect(parseRun(run, catalogues)).toMatchObject({ ok: false });
  });

  it('refuses a log entry that names a kit the catalogue does not have', () => {
    const run = stored(wins(start(), 2)) as { log: { kit: string }[] };
    const first = run.log[0];
    if (first) first.kit = 'Not_A_Kit_00';
    expect(parseRun(run, catalogues)).toMatchObject({ ok: false });
  });
});

// This fixture is a run saved in format 5, the first with the restart reset: two wins, a loss on
// its last life that drew the run again, and a win after it. It stays as it is (failure 3).
describe('a run saved with a restart', () => {
  it('reads forever, on the order its reset drew, its log naming the kits played', () => {
    const parsed = parseRun(structuredClone(v5), { '0.0.1': fixtureCatalogue as Catalogue });
    expect(parsed).toMatchObject({
      ok: true,
      state: { schema: 5, resetRule: 'restart', resets: 1, conquered: 1 },
    });
    if (!parsed.ok) return;
    expect(parsed.state.order).toEqual(v5.redraws['1'].order);
    expect(parsed.state.log.map((e) => e.kit)).toEqual(v5.log.map((e) => e.kit));
  });
});
