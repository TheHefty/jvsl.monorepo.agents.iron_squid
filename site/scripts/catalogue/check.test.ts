import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../../src/catalogue/types';
import { catalogueProblems } from './check';

const item = (id: string) => ({ id, name: { 'en-US': id }, image: `${id}.png` });
const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => item(`${prefix}${i}`));
const cat = (kits: number, head: number, clothes: number, shoes: number): Catalogue => ({
  version: '11.3.0',
  datamine: { repo: 'r', commit: 'c', dataFolder: '1130' },
  kits: ids('K', kits),
  gear: { head: ids('H', head), clothes: ids('C', clothes), shoes: ids('S', shoes) },
  excluded: { replicas: [], unobtainable: [] },
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

  it('refuses an item with no name or no image', () => {
    const c = cat(1, 1, 1, 1);
    c.kits[0] = { id: 'K0', name: { 'en-US': '' }, image: '' };
    expect(catalogueProblems(c)).toEqual([
      'catalogue 11.3.0: K0 has no en-US name',
      'catalogue 11.3.0: K0 has no image',
    ]);
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
