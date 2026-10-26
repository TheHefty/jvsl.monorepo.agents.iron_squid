import { describe, expect, it } from 'vitest';
import { gearSlots, type Catalogue, type GearSlot } from '../catalogue/types';
import { decodeShare, encodeShare } from '../share/link';
import {
  currentSet,
  gearOf,
  reportLoss,
  reportWin,
  reroll,
  rerollRefusal,
  startRun,
  undo,
  type RunState,
} from './engine';
import { parseRun } from './parse';
import { cryptoSource } from './random';
import v2 from './fixtures/run-v2.json';
import v3 from './fixtures/run-v3.json';
import fixtureCatalogue from './fixtures/catalogue-0.0.1.json';

// The re-roll of gear (FR-25, FR-14 as amended): a piece the player does not have is given up for
// the next spare of its slot, fixed when the run started; the piece given up is spent.
const item = (id: string) => ({ id, image: `${id}.png` });
const piece = (id: string) => ({ ...item(id), brand: 'B00' });
const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);
// 3 kits; 6 headgear, 5 clothing and 3 shoes: 3, 2 and 0 spares.
const catalogue: Catalogue = {
  version: '0.0.1',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1' },
  kits: ids('K', 3).map(item),
  gear: {
    head: ids('H', 6).map(piece),
    clothes: ids('C', 5).map(piece),
    shoes: ids('S', 3).map(piece),
  },
  brands: [{ id: 'B00', image: 'brand/B00.png' }],
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
};
const at = '2026-10-26T12:00:00.000Z';
const start = () => startRun(catalogue, { name: undefined }, cryptoSource, at);
const win = (s: RunState) => reportWin(s, { step: s.step, at, mode: 'Pnt' });
const lose = (s: RunState) => reportLoss(s, { step: s.step, at, mode: 'Pnt' });
const re = (s: RunState, slot: GearSlot) => reroll(s, { step: s.step, at, slot });
const catalogues = { '0.0.1': catalogue };
const stored = (s: RunState) => JSON.parse(JSON.stringify(s)) as unknown;

describe('a re-roll', () => {
  it('gives the set the next spare of that slot, and leaves the rest of the set as it was', () => {
    const s = start();
    const before = currentSet(s);
    const after = re(s, 'head');
    expect(currentSet(after)).toEqual({ ...before, head: s.order.head[3] });
  });

  it('can be made as often as there are spares, each piece given up spent', () => {
    let s = start();
    const worn = [currentSet(s).head];
    for (let n = 0; n < 3; n++) {
      s = re(s, 'head');
      worn.push(currentSet(s).head);
    }
    expect(new Set(worn).size).toBe(4);
    expect(rerollRefusal(s, 'head')).toBe('no-spare');
    expect(() => re(s, 'head')).toThrow(/spare/);
  });

  it('is refused for a slot with no spare: the run could not be finished (failure 2)', () => {
    const s = start();
    expect(rerollRefusal(s, 'shoes')).toBe('no-spare');
    expect(() => re(s, 'shoes')).toThrow(/spare/);
  });

  it('never gives a piece that is drawn later, or one already given up (failure 2)', () => {
    // Re-roll everything a run allows at every set; every piece worn in the run is worn once.
    const r = new Uint32Array(1);
    for (let trial = 0; trial < 50; trial++) {
      let s = start();
      const worn: Record<GearSlot, string[]> = { head: [], clothes: [], shoes: [] };
      for (let set = 0; set < 3; set++) {
        for (const slot of gearSlots) {
          crypto.getRandomValues(r);
          for (let k = 0; k < (r[0] ?? 0) % 3; k++) if (!rerollRefusal(s, slot)) s = re(s, slot);
        }
        for (const slot of gearSlots) worn[slot].push(currentSet(s)[slot]);
        s = win(s);
      }
      for (const slot of gearSlots) expect(new Set(worn[slot]).size, slot).toBe(3);
    }
  });

  it('is the same piece in two copies of the same run (FR-14)', () => {
    const s = start();
    const copy = structuredClone(s);
    expect(currentSet(re(s, 'clothes'))).toEqual(currentSet(re(copy, 'clothes')));
  });

  it('is refused once a result is reported for the set', () => {
    let s = win(win(start()));
    s = { ...s, lives: 2 };
    const lost = lose(s);
    expect(rerollRefusal(lost, 'head')).toBe('played');
    expect(() => re(lost, 'head')).toThrow(/result/);
  });

  it('is refused on a replay, which keeps the gear the set was won with (FR-18)', () => {
    const replaying = lose(win(start()));
    expect(replaying.cursor).toBe(0);
    expect(rerollRefusal(replaying, 'head')).toBe('replay');
    expect(() => re(replaying, 'head')).toThrow(/replay/);
  });

  it('cannot be undone, and takes away the undo of the result before it (failure 1)', () => {
    const s = re(win(start()), 'head');
    expect(s.previous).toBeUndefined();
    expect(() => undo(s)).toThrow(/nothing to undo/);
  });

  it('stays when the result after it is undone', () => {
    const s = re(start(), 'head');
    const back = undo(lose({ ...s, lives: 2 }));
    expect(currentSet(back)).toEqual(currentSet(s));
  });

  it('is kept by the set it was made on: won, it is the gear the set was conquered with', () => {
    const s = win(re(start(), 'clothes'));
    expect(gearOf(s, 0).clothes).toBe(s.order.clothes[3]);
  });

  it('is recorded, with the piece given up and the one given (FR-24)', () => {
    const s = start();
    const after = re(s, 'head');
    expect(after.rerolls).toEqual([
      {
        at,
        draw: 0,
        slot: 'head',
        from: s.order.head[0],
        to: s.order.head[3],
        afterMatches: 0,
      },
    ]);
  });

  it('survives storage, and a run that was reloaded gives the same next piece (failure 1)', () => {
    const s = re(start(), 'head');
    const parsed = parseRun(stored(s), catalogues);
    expect(parsed).toMatchObject({ ok: true });
    if (!parsed.ok) return;
    expect(currentSet(parsed.state)).toEqual(currentSet(s));
    expect(currentSet(re(parsed.state, 'head'))).toEqual(currentSet(re(s, 'head')));
  });

  it('shows on a share link as the piece worn, not the one given up', () => {
    const s = win(re(start(), 'head'));
    // The share codec needs every list to fit; this run is on the small test catalogue.
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared.ok && shared.run.sets[0]?.head).toBe(s.order.head[3]);
  });
});

describe('a stored run with re-rolls that cannot be true', () => {
  const tampered = (patch: (run: Record<string, unknown>) => void) => {
    const run = stored(re(start(), 'head')) as Record<string, unknown>;
    patch(run);
    return parseRun(run, catalogues);
  };

  it('is refused when a set wears a piece that is not a spare', () => {
    expect(
      tampered((run) => {
        (run.worn as Record<string, Record<string, number>>).head = { '0': 1 };
      }),
    ).toMatchObject({ ok: false, reason: 'not-a-run' });
  });

  it('is refused when more spares are counted spent than the slot has', () => {
    expect(
      tampered((run) => {
        (run.spent as Record<string, number>).head = 4;
      }),
    ).toMatchObject({ ok: false, reason: 'not-a-run' });
  });
});

// This fixture is a run saved in format 3, the first with re-rolls: its draw 1 wears the shoes it
// was re-rolled to. It stays as it is, like the format 1 and 2 fixtures (failure 3).
describe('a run saved with a re-roll', () => {
  it('reads forever, wearing the piece it was re-rolled to', () => {
    const parsed = parseRun(structuredClone(v3), { '0.0.1': fixtureCatalogue as Catalogue });
    expect(parsed).toMatchObject({ ok: true, state: { schema: 3, cursor: 1 } });
    if (parsed.ok) {
      expect(currentSet(parsed.state).shoes).toBe(v3.order.shoes[3]);
      expect(parsed.state.rerolls).toEqual(v3.rerolls);
    }
  });
});

describe('runs saved before re-rolls (failure 3)', () => {
  it('still load, with nothing re-rolled', () => {
    const parsed = parseRun(
      structuredClone(v2),
      { '0.0.1': fixtureCatalogue as Catalogue },
      '2026-10-26T00:00:00.000Z',
    );
    expect(parsed).toMatchObject({
      ok: true,
      state: { schema: 3, spent: { head: 0, clothes: 0, shoes: 0 }, rerolls: [] },
    });
  });
});
