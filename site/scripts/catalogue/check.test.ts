import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../../src/catalogue/types';
import { catalogueProblems, nameProblems } from './check';

const item = (id: string) => ({ id, image: `${id}.png` });
const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => item(`${prefix}${i}`));
const cat = (kits: number, head: number, clothes: number, shoes: number): Catalogue => ({
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', kits),
  gear: { head: ids('H', head), clothes: ids('C', clothes), shoes: ids('S', shoes) },
  excluded: { replicas: [], unobtainable: [] },
  modes: [{ id: 'M0' }],
});

describe('catalogueProblems', () => {
  it('accepts a catalogue a whole run can be played with', () => {
    expect(catalogueProblems(cat(3, 3, 4, 5))).toEqual([]);
  });

  it('refuses a gear slot with fewer pieces than there are kits, naming it', () => {
    expect(catalogueProblems(cat(3, 3, 2, 5))).toEqual([
      'catalogue 11.3.0: the clothes slot has 2 pieces and there are 3 kits; a run needs one unused piece per kit',
    ]);
  });

  it('refuses an item with no image', () => {
    const c = cat(1, 1, 1, 1);
    c.kits[0] = { id: 'K0', image: '' };
    expect(catalogueProblems(c)).toEqual(['catalogue 11.3.0: K0 has no image']);
  });

  it('refuses an id used twice', () => {
    const c = cat(2, 2, 2, 2);
    c.gear.head[1] = item('K0');
    expect(catalogueProblems(c)).toEqual(['catalogue 11.3.0: the id K0 is used more than once']);
  });

  it('refuses a catalogue with no kits', () => {
    expect(catalogueProblems(cat(0, 0, 0, 0))).toEqual(['catalogue 11.3.0: no kits']);
  });
});

describe('nameProblems', () => {
  const c = cat(1, 1, 1, 1);
  const all = { K0: 'Kit', H0: 'Hat', C0: 'Coat', S0: 'Shoes', M0: 'Mode' };

  it('accepts names for every item in every locale', () => {
    expect(nameProblems(c, { 'en-US': all, 'ko-KR': all }, ['en-US', 'ko-KR'])).toEqual([]);
  });

  it('names the item and the locale a name is missing in (localized-names, failure 1)', () => {
    const { K0: _, ...ko } = all;
    void _;
    expect(
      nameProblems(c, { 'en-US': all, 'ko-KR': { ...ko, H0: '' } }, ['en-US', 'ko-KR']),
    ).toEqual(['catalogue 11.3.0: K0 has no ko-KR name', 'catalogue 11.3.0: H0 has no ko-KR name']);
  });

  it('names a locale with no names at all', () => {
    expect(nameProblems(c, { 'en-US': all }, ['en-US', 'ja-JP'])).toEqual([
      'catalogue 11.3.0 has no names for ja-JP',
    ]);
  });

  it('names a mode without a name in a locale (match-modes)', () => {
    const { M0: _, ...noMode } = all;
    void _;
    expect(nameProblems(c, { 'en-US': all, 'ko-KR': noMode }, ['en-US', 'ko-KR'])).toEqual([
      'catalogue 11.3.0: M0 has no ko-KR name',
    ]);
  });
});

describe('catalogueProblems, for modes', () => {
  it('refuses a catalogue with no modes, since every result names one', () => {
    const c = cat(1, 1, 1, 1);
    c.modes = [];
    expect(catalogueProblems(c)).toEqual(['catalogue 11.3.0: no modes']);
  });
});
