import { describe, expect, it } from 'vitest';
import published from '../catalogue/11.3.0/catalogue.json';
import type { Catalogue } from '../catalogue/types';
import { nextSet, reportLoss, reportWin, startRun, type RunState } from '../run/engine';
import { cryptoSource } from '../run/random';
import { decodeShare, encodeShare, packShare, widthsOf, type Packed } from './link';

const catalogue = published as Catalogue;
const catalogues = { '11.3.0': catalogue };
const at = '2026-10-20T12:00:00.000Z';
const site = 'https://iron-squid.top/en-US/run/#';

function played(wins: number, name?: string): RunState {
  let s = startRun(catalogue, { name }, cryptoSource, at);
  for (let i = 0; i < wins; i++) {
    s = reportWin(s, { step: s.step, at });
    if (s.conquered < s.order.kits.length) s = nextSet(s, { step: s.step });
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
  sets: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
  ],
});

describe('a share link', () => {
  it('carries what a shared run shows, and reads back to it', () => {
    let s = played(12, 'Inkling Ivo');
    s = reportLoss(s, { step: s.step, at });
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
        complete: false,
        sets: Array.from({ length: 12 }, (_, i) => ({
          kit: s.order.kits[i],
          head: s.order.head[i],
          clothes: s.order.clothes[i],
          shoes: s.order.shoes[i],
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
    ['a format it does not know', textOf(Uint8Array.of(2, 0))],
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
    p.sets[1] = [1, 300, 1, 1]; // 266 head pieces, written in 9 bits
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
