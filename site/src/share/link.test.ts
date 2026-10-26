import { describe, expect, it } from 'vitest';
import published from '../catalogue/11.3.0/catalogue.json';
import type { Catalogue } from '../catalogue/types';
import { reportLoss, reportWin, reroll, startRun, type RunState } from '../run/engine';
import { cryptoSource } from '../run/random';
import { decodeShare, encodeShare, packShare, widthsOf, type Packed } from './link';

const catalogue = published as Catalogue;
const catalogues = { '11.3.0': catalogue };
const at = '2026-10-20T12:00:00.000Z';
const site = 'https://iron-squid.top/en-US/run/#';

function played(wins: number, name?: string): RunState {
  let s = startRun(catalogue, { name }, cryptoSource, at);
  for (let i = 0; i < wins; i++) {
    s = reportWin(s, { step: s.step, at, mode: 'Pnt' });
  }
  return s;
}

// The bytes of a link, to tamper with, and back.
const bytesOf = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const textOf = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const valid = (): Packed => ({
  version: '11.3.0',
  name: new TextEncoder().encode('Ivo'),
  conquered: 2,
  lives: 1,
  resets: 0,
  // Kit, head, clothes, shoes, and the mode of the conquest (format 2): 0 none, then the modes.
  sets: [
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
});

describe('a share link', () => {
  it('carries what a shared run shows, and reads back to it', () => {
    let s = played(12, 'Inkling Ivo');
    s = reportLoss(s, { step: s.step, at, mode: 'Pnt', source: cryptoSource });
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared).toEqual({
      ok: true,
      run: {
        catalogueVersion: '11.3.0',
        name: 'Inkling Ivo',
        conquered: 12,
        total: 160,
        lives: s.lives,
        resets: s.resets,
        rerolls: 0,
        complete: false,
        sets: Array.from({ length: 12 }, (_, i) => ({
          kit: s.order.kits[i],
          head: s.order.head[i],
          clothes: s.order.clothes[i],
          shoes: s.order.shoes[i],
          mode: 'Pnt',
        })),
      },
    });
  });

  it('never carries the sets not yet conquered', () => {
    const s = played(3);
    const link = encodeShare(s, catalogue);
    const later = {
      ...s,
      order: {
        ...s.order,
        kits: [...s.order.kits.slice(0, 3), ...s.order.kits.slice(3).reverse()],
      },
    };
    expect(encodeShare(later, catalogue)).toBe(link);
  });

  it('fits a complete run with the largest name allowed in 2,000 characters (NFR-P2, failure 2)', () => {
    // 16 characters of 18 bytes and 3 of 4: 300 bytes, the most a name may have.
    const name = '👩‍👩‍👧'.repeat(16) + '🦑'.repeat(3);
    expect(new TextEncoder().encode(name)).toHaveLength(300);
    const s = played(160, name);
    expect(s.conquered).toBe(160);
    const link = site + encodeShare(s, catalogue);
    expect(link.length).toBeLessThanOrEqual(2000);
    expect(decodeShare(encodeShare(s, catalogue), catalogues)).toMatchObject({
      ok: true,
      run: { name, conquered: 160, complete: true },
    });
  });

  it('is written only in the characters of base64url', () => {
    expect(encodeShare(played(5, 'Ivo 🦑'), catalogue)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('leaves out a name too long for a link, rather than failing to make one', () => {
    const s = { ...played(1), name: '👨‍👩‍👧‍👦'.repeat(30) };
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared.ok && shared.run.conquered).toBe(1);
    expect(shared.ok && 'name' in shared.run).toBe(false);
  });
});

describe('reading a share link', () => {
  const broken = { ok: false, reason: 'broken' };
  const read = (p: Packed) => decodeShare(packShare(p, widthsOf(catalogue)), catalogues);

  it('reads the packed form it is given', () => {
    expect(read(valid())).toMatchObject({ ok: true, run: { name: 'Ivo', conquered: 2 } });
  });

  it.each([
    ['nothing', ''],
    ['characters outside base64url', 'abc$def'],
    ['a format it does not know', textOf(Uint8Array.of(4, 0))],
  ])('refuses %s as broken', (_label, text) => {
    expect(decodeShare(text, catalogues)).toEqual(broken);
  });

  it('refuses every truncation of a valid link, and a link with bytes left over (failure 1)', () => {
    const bytes = bytesOf(encodeShare(played(20, 'Inkling Ivo'), catalogue));
    for (let n = 0; n < bytes.length; n++) {
      expect(decodeShare(textOf(bytes.slice(0, n)), catalogues), `${n} bytes`).toEqual(broken);
    }
    expect(decodeShare(textOf(Uint8Array.of(...bytes, 0)), catalogues)).toEqual(broken);
  });

  it('refuses an index past the end of its catalogue list', () => {
    const p = valid();
    p.sets[1] = [1, 300, 1, 1, 1]; // 266 head pieces, written in 9 bits
    expect(read(p)).toEqual(broken);
  });

  it('refuses a kit or a gear piece used twice in the run', () => {
    for (const slot of [0, 1, 2, 3]) {
      const p = valid();
      const second = p.sets[1] as number[];
      second[slot] = 0;
      expect(read(p), `slot ${slot}`).toEqual(broken);
    }
  });

  it('refuses a run with no lives, or more conquered than there are kits', () => {
    expect(read({ ...valid(), lives: 0 })).toEqual(broken);
    expect(read({ ...valid(), conquered: 161, sets: [] })).toEqual(broken);
  });

  it('refuses a name that is not text, or that breaks the name rule', () => {
    expect(read({ ...valid(), name: Uint8Array.of(0xff, 0xfe) })).toEqual(broken);
    expect(read({ ...valid(), name: new TextEncoder().encode('a'.repeat(31)) })).toEqual(broken);
    expect(read({ ...valid(), name: new TextEncoder().encode('  Ivo') })).toEqual(broken);
  });

  it('names the catalogue version a run needs when the site does not carry it', () => {
    expect(read({ ...valid(), version: '9.9.9' })).toEqual({
      ok: false,
      reason: 'unknown-catalogue',
      version: '9.9.9',
    });
    expect(read({ ...valid(), version: '<b>' })).toEqual(broken);
  });

  it('never throws on a damaged link: each one is refused or reads as a valid run (failure 1)', () => {
    const bytes = bytesOf(encodeShare(played(30, 'Ivo'), catalogue));
    let seed = 1;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 10_000; i++) {
      const damaged = bytes.slice();
      damaged[Math.floor(random() * damaged.length)] = Math.floor(random() * 256);
      const result = decodeShare(textOf(damaged), catalogues);
      if (!result.ok) continue;
      const { run } = result;
      expect(run.sets).toHaveLength(run.conquered);
      for (const slot of ['kit', 'head', 'clothes', 'shoes'] as const) {
        expect(new Set(run.sets.map((s) => s[slot])).size).toBe(run.conquered);
      }
      expect(run.lives).toBeGreaterThan(0);
    }
  });
});

describe('the mode of each conquest (share-mode)', () => {
  const modes = catalogue.modes.map((m) => m.id);
  const win = (s: RunState, mode: string) => reportWin(s, { step: s.step, at, mode });
  const lose = (s: RunState) =>
    reportLoss(s, { step: s.step, at, mode: 'Pnt', source: cryptoSource });

  it('carries the mode each set was conquered in', () => {
    let s = startRun(catalogue, { name: undefined }, cryptoSource, at);
    for (const mode of modes) s = win(s, mode);
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared.ok && shared.run.sets.map((set) => set.mode)).toEqual(modes);
  });

  it('keeps the mode of the conquest, not of a replay won since', () => {
    let s = win(win(startRun(catalogue, { name: undefined }, cryptoSource, at), 'Vgl'), 'Vgl');
    s = win(lose(s), 'Tcl'); // reset, then the first set replayed in another mode
    const shared = decodeShare(encodeShare(s, catalogue), catalogues);
    expect(shared.ok && shared.run.sets.map((set) => set.mode)).toEqual(['Vgl', 'Vgl']);
  });

  it('carries no mode for a set conquered before modes were recorded', () => {
    const s = played(2);
    const old = { ...s, log: s.log.map(({ mode: _mode, ...e }) => (void _mode, e)) };
    const shared = decodeShare(encodeShare(old, catalogue), catalogues);
    expect(shared.ok && shared.run.sets.map((set) => 'mode' in set)).toEqual([false, false]);
  });

  it('still reads a link made in format 1, its sets without a mode (failure 1)', () => {
    const p = { ...valid(), sets: valid().sets.map((set) => set.slice(0, 4)) };
    const shared = decodeShare(packShare(p, widthsOf(catalogue, 1), 1), catalogues);
    expect(shared).toMatchObject({ ok: true, run: { name: 'Ivo', conquered: 2 } });
    expect(shared.ok && shared.run.sets.map((set) => 'mode' in set)).toEqual([false, false]);
  });

  it('refuses a mode past the end of the catalogue modes (failure 2)', () => {
    const p = valid();
    p.sets[1] = [1, 1, 1, 1, modes.length + 1];
    expect(decodeShare(packShare(p, widthsOf(catalogue)), catalogues)).toEqual({
      ok: false,
      reason: 'broken',
    });
  });

  it('fits a complete run, every set in a mode, with the largest name in 2,000 characters (failure 3)', () => {
    const name = '👩‍👩‍👧'.repeat(16) + '🦑'.repeat(3);
    let s = startRun(catalogue, { name }, cryptoSource, at);
    for (let n = 0; n < 160; n++) s = win(s, modes[n % modes.length] ?? 'Pnt');
    const link = site + encodeShare(s, catalogue);
    expect(link.length).toBeLessThanOrEqual(2000);
    expect(decodeShare(encodeShare(s, catalogue), catalogues)).toMatchObject({
      ok: true,
      run: { name, conquered: 160, complete: true },
    });
  });
});

describe('the re-rolls of a run (share-rerolls)', () => {
  const spares = (['head', 'clothes', 'shoes'] as const).reduce(
    (n, slot) => n + catalogue.gear[slot].length - catalogue.kits.length,
    0,
  );
  const rerolled = (times: number, wins: number) => {
    let s = startRun(catalogue, { name: 'Ivo' }, cryptoSource, at);
    for (let n = 0; n < times; n++) s = reroll(s, { step: s.step, at, slot: 'head' });
    for (let n = 0; n < wins; n++) s = reportWin(s, { step: s.step, at, mode: 'Pnt' });
    return s;
  };

  it('carries how many pieces were re-rolled away', () => {
    const shared = decodeShare(encodeShare(rerolled(4, 2), catalogue), catalogues);
    expect(shared).toMatchObject({ ok: true, run: { rerolls: 4, conquered: 2 } });
  });

  it('reads a link made before re-rolls as none (failure 1)', () => {
    const p = valid();
    expect(decodeShare(packShare(p, widthsOf(catalogue, 2), 2), catalogues)).toMatchObject({
      ok: true,
      run: { rerolls: 0, conquered: 2 },
    });
  });

  it('refuses more re-rolls than the catalogue has spares (failure 2)', () => {
    expect(
      decodeShare(packShare({ ...valid(), rerolls: spares + 1 }, widthsOf(catalogue)), catalogues),
    ).toEqual({ ok: false, reason: 'broken' });
    expect(
      decodeShare(packShare({ ...valid(), rerolls: spares }, widthsOf(catalogue)), catalogues),
    ).toMatchObject({ ok: true, run: { rerolls: spares } });
  });

  it('fits a complete run that spent every spare, with the largest name, in 2,000 characters (failure 3)', () => {
    const name = '👩‍👩‍👧'.repeat(16) + '🦑'.repeat(3);
    let s = startRun(catalogue, { name }, cryptoSource, at);
    for (const slot of ['head', 'clothes', 'shoes'] as const)
      for (let n = 0; n < catalogue.gear[slot].length - catalogue.kits.length; n++)
        s = reroll(s, { step: s.step, at, slot });
    for (let n = 0; n < 160; n++) s = reportWin(s, { step: s.step, at, mode: 'Tcl' });
    expect(s.rerolls).toHaveLength(spares);
    const link = site + encodeShare(s, catalogue);
    expect(link.length).toBeLessThanOrEqual(2000);
    expect(decodeShare(encodeShare(s, catalogue), catalogues)).toMatchObject({
      ok: true,
      run: { rerolls: spares, conquered: 160, complete: true },
    });
  });
});
