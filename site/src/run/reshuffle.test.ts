import { describe, expect, it } from 'vitest';
import { gearSlots, type Catalogue, type GearSlot } from '../catalogue/types';
import { decodeShare, encodeShare } from '../share/link';
import {
  currentSet,
  gearOf,
  isReplay,
  replaysRemaining,
  reportLoss,
  reportWin,
  reroll,
  rerollRefusal,
  startRun,
  undo,
  type CurrentSet,
  type RunState,
} from './engine';
import { parseRun } from './parse';
import { cryptoSource } from './random';
import v3 from './fixtures/run-v3.json';
import v4 from './fixtures/run-v4.json';
import fixtureCatalogue from './fixtures/catalogue-0.0.1.json';

// The reset of runs started after 2026-10-26 (FR-13, FR-14, FR-18, FR-25 as amended): each reset
// replays the conquered kits in a new order, with the gear they were last won with dealt out again.
const item = (id: string) => ({ id, image: `${id}.png` });
const piece = (id: string) => ({ ...item(id), brand: 'B00' });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
const catalogue: Catalogue = {
  version: '0.0.1',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1' },
  kits: ids('K', 20).map(item),
  gear: {
    head: ids('H', 30).map(piece),
    clothes: ids('C', 30).map(piece),
    shoes: ids('S', 30).map(piece),
  },
  brands: [{ id: 'B00', image: 'brand/B00.png' }],
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const catalogues = { '0.0.1': catalogue };
const at = '2026-10-26T12:00:00.000Z';
const source = cryptoSource;
const start = () => startRun(catalogue, { name: undefined, resetRule: 'reshuffle' }, source, at);
const win = (s: RunState) => reportWin(s, { step: s.step, at, mode: 'Pnt' });
const lose = (s: RunState) => reportLoss(s, { step: s.step, at, mode: 'Pnt', source });
const wins = (s: RunState, n: number) => {
  for (let i = 0; i < n; i++) s = win(s);
  return s;
};
const re = (s: RunState, slot: GearSlot) => reroll(s, { step: s.step, at, slot });
// Loses until the run resets: 12 wins have earned a second life, so the first loss does not.
function reset(s: RunState): RunState {
  while (s.lives > 1) s = lose(s);
  return lose(s);
}
// The sets of a whole replay, in the order played: winning each one in turn.
function replays(s: RunState): CurrentSet[] {
  const sets: CurrentSet[] = [];
  while (isReplay(s)) {
    sets.push(currentSet(s));
    s = win(s);
  }
  return sets;
}
const sorted = (xs: string[]) => [...xs].sort();
const conquests = (s: RunState) => Array.from({ length: s.conquered }, (_, n) => gearOf(s, n));
const stored = (s: RunState) => JSON.parse(JSON.stringify(s)) as unknown;

describe('a run started with the reshuffled reset', () => {
  it('follows it', () => {
    expect(start().resetRule).toBe('reshuffle');
  });
});

describe('a reset (FR-18)', () => {
  const twelve = () => wins(start(), 12);

  it('replays the same kits, in an order drawn for it', () => {
    const before = twelve();
    const sets = replays(reset(before));
    expect(sorted(sets.map((s) => s.kit))).toEqual(sorted(before.order.kits.slice(0, 12)));
    // 1 in 12! that a fair draw gives the order of conquest back.
    expect(sets.map((s) => s.kit)).not.toEqual(before.order.kits.slice(0, 12));
  });

  it('deals out exactly the gear the kits were won with, not each to its own kit', () => {
    const before = twelve();
    const sets = replays(reset(before));
    const won = conquests(before);
    for (const slot of gearSlots)
      expect(sorted(sets.map((s) => s[slot])), slot).toEqual(sorted(won.map((w) => w[slot])));
    const ownGear = sets.filter((s) => {
      const w = won.find((x) => x.kit === s.kit);
      return w && gearSlots.every((slot) => w[slot] === s[slot]);
    });
    expect(ownGear.length).toBeLessThan(12);
  });

  it('spends no unused piece: the first new draw after it is the one that was next', () => {
    const before = twelve();
    const next = currentSet(before);
    let s = reset(before);
    while (isReplay(s)) s = win(s);
    expect(currentSet(s)).toEqual(next);
  });

  it('draws again at every reset (failure 2: the pool is kept whole)', () => {
    let s = reset(twelve());
    const first = replays(s);
    while (isReplay(s)) s = win(s);
    const second = replays(reset(s));
    expect(second.map((x) => x.kit)).not.toEqual(first.map((x) => x.kit));
    for (const slot of gearSlots)
      expect(sorted(second.map((x) => x[slot])), slot).toEqual(sorted(first.map((x) => x[slot])));
  });

  it('deals the replays that were not reached again, with the gear they were dealt', () => {
    // Lost on the fourth replay: the next reset still holds every piece once.
    let s = reset(twelve());
    s = wins(s, 3);
    const again = replays(reset({ ...s, lives: 2 }));
    for (const slot of gearSlots) expect(new Set(again.map((x) => x[slot])).size, slot).toBe(12);
  });

  it('counts its replays as before (FR-19)', () => {
    let s = reset(twelve());
    s = wins(s, 4);
    expect(isReplay(s)).toBe(true);
    expect(replaysRemaining(s)).toBe(8);
  });

  it('logs each replay with its own kit', () => {
    let s = reset(twelve());
    const kit = currentSet(s).kit;
    s = win(s);
    const last = s.log.at(-1);
    expect(last).toMatchObject({ replay: true, result: 'win' });
    expect(s.order.kits[last?.draw ?? -1]).toBe(kit);
  });
});

describe('undo (FR-14, failure 1)', () => {
  it('cannot draw the replays again: the same loss brings the same replays', () => {
    const first = reset(wins(start(), 12));
    const again = reset(undo(first));
    expect(again.replays).toEqual(first.replays);
    expect(replays(again)).toEqual(replays(first));
  });

  it('over random walks of wins, losses and undos, never re-draws a reset', () => {
    const r = new Uint32Array(1);
    for (let trial = 0; trial < 30; trial++) {
      let s = wins(start(), 6);
      const seen = new Map<string, string>();
      for (let step = 0; step < 120; step++) {
        crypto.getRandomValues(r);
        const choice = (r[0] ?? 0) % 4;
        try {
          s = choice < 2 ? win(s) : choice === 2 ? lose(s) : undo(s);
        } catch {
          continue;
        }
        if (isReplay(s) && s.cursor === 0) {
          const key = `${s.resets}:${s.matches}`;
          const set = JSON.stringify(currentSet(s));
          if (seen.has(key)) expect(set, key).toBe(seen.get(key));
          seen.set(key, set);
        }
      }
    }
  });
});

describe('a re-roll on a replay (FR-25)', () => {
  it('is allowed before the replay has a result, and spends a spare', () => {
    const s = reset(wins(start(), 12));
    expect(rerollRefusal(s, 'shoes')).toBeUndefined();
    const after = re(s, 'shoes');
    expect(currentSet(after).shoes).toBe(s.order.shoes[20]);
    expect(currentSet(after).kit).toBe(currentSet(s).kit);
  });

  it('is refused once the replay has a result', () => {
    const s = lose({ ...reset(wins(start(), 12)), lives: 2 });
    expect(isReplay(s)).toBe(true);
    expect(rerollRefusal(s, 'shoes')).toBe('played');
  });

  it('takes the piece given up out of the next reset, and deals the new one instead', () => {
    let s = reset(wins(start(), 12));
    const given = currentSet(s).shoes;
    s = re(s, 'shoes');
    const taken = currentSet(s).shoes;
    while (isReplay(s)) s = win(s);
    const next = replays(reset(s));
    expect(next.map((x) => x.shoes)).not.toContain(given);
    expect(next.map((x) => x.shoes)).toContain(taken);
  });

  it('leaves the gear a kit was first conquered with as it was: the share link shows it', () => {
    let s = reset(wins(start(), 12));
    const firstConquest = conquests(s);
    s = re(s, 'head');
    expect(conquests(s)).toEqual(firstConquest);
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared.ok && shared.run.sets.map((x) => x.head)).toEqual(
      firstConquest.map((x) => x.head),
    );
  });
});

describe('a run started before the change (failure 3)', () => {
  it('loads with the earlier reset, and replays in order with the same gear', () => {
    const parsed = parseRun(structuredClone(v3), { '0.0.1': fixtureCatalogue as Catalogue });
    expect(parsed).toMatchObject({ ok: true, state: { resetRule: 'in-order' } });
  });

  it('keeps replaying in the order of conquest, with no re-roll on a replay', () => {
    const old: RunState = { ...wins(start(), 5), resetRule: 'in-order' };
    const s = lose(old);
    expect(replays(s)).toEqual(conquests(old));
    expect(rerollRefusal(s, 'head')).toBe('replay');
  });
});

// This fixture is a run saved in format 4, the first with reshuffled resets: reset 1 replays draw 1
// first, then draw 0, with their gear dealt as stored. It stays as it is (failure 3).
describe('a run saved with a reshuffled reset', () => {
  it('reads forever, replaying what its reset drew', () => {
    const parsed = parseRun(structuredClone(v4), { '0.0.1': fixtureCatalogue as Catalogue });
    expect(parsed).toMatchObject({ ok: true, state: { schema: 4, resetRule: 'reshuffle' } });
    if (!parsed.ok) return;
    const r = v4.replays['1'];
    expect(currentSet(parsed.state)).toEqual({
      kit: v4.order.kits[r.draws[0] ?? -1],
      head: v4.order.head[r.gear.head[0] ?? -1],
      clothes: v4.order.clothes[r.gear.clothes[0] ?? -1],
      shoes: v4.order.shoes[r.gear.shoes[0] ?? -1],
    });
  });
});

describe('storage', () => {
  it('keeps the replays of a reset, so a reload plays the same ones', () => {
    const s = wins(reset(wins(start(), 12)), 2);
    const parsed = parseRun(stored(s), catalogues);
    expect(parsed).toMatchObject({ ok: true });
    if (parsed.ok) expect(replays(parsed.state)).toEqual(replays(s));
  });

  it('refuses replays that cannot be true: a kit twice, or a piece not in the pool', () => {
    const s = reset(wins(start(), 12)) as unknown as Record<string, unknown>;
    const bad = (patch: (r: { draws: number[]; gear: Record<GearSlot, number[]> }) => void) => {
      const run = stored(s as unknown as RunState) as {
        replays: Record<string, { draws: number[]; gear: Record<GearSlot, number[]> }>;
      };
      const r = run.replays['1'];
      if (r) patch(r);
      return parseRun(run, catalogues);
    };
    expect(bad((r) => (r.draws[1] = r.draws[0] ?? 0))).toMatchObject({ ok: false });
    expect(bad((r) => (r.gear.head[0] = 29))).toMatchObject({ ok: false });
  });
});
