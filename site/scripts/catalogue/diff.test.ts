import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../../src/catalogue/types';
import { describeDiff, diffCatalogues } from './diff';

const item = (id: string) => ({ id, image: `${id}.png` });
const cat = (kits: string[], head: string[]): Catalogue => ({
  version: 'v',
  datamine: { repo: 'r', commit: 'c', dataFolder: 'f' },
  kits: kits.map(item),
  gear: { head: head.map(item), clothes: [], shoes: [] },
  excluded: { replicas: [], unobtainable: [] },
});

describe('diffCatalogues', () => {
  it('lists what a new version adds and removes, per kind', () => {
    const d = diffCatalogues(cat(['A', 'B'], ['H1']), cat(['A', 'C'], ['H1', 'H2']));
    expect(d).toEqual({
      kits: { added: ['C'], removed: ['B'] },
      head: { added: ['H2'], removed: [] },
      clothes: { added: [], removed: [] },
      shoes: { added: [], removed: [] },
    });
    expect(describeDiff(d)).toBe('kits: +1 (C), -1 (B)\nhead: +1 (H2)');
  });

  it('says so when nothing changed', () => {
    expect(describeDiff(diffCatalogues(cat(['A'], []), cat(['A'], [])))).toBe(
      'no kits or gear added or removed',
    );
  });
});
