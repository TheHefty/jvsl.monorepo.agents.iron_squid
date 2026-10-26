import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../../src/catalogue/types';
import { describeDiff, diffCatalogues, removedIds } from './diff';

const item = (id: string) => ({ id, image: `${id}.png` });
const cat = (kits: string[], head: string[]): Catalogue => ({
  version: 'v',
  datamine: { repo: 'r', commit: 'c', dataFolder: 'f' },
  kits: kits.map(item),
  gear: { head: head.map((id) => ({ ...item(id), brand: 'B00' })), clothes: [], shoes: [] },
  brands: [{ id: 'B00', image: 'brand/B00.png' }],
  excluded: { replicas: [], unobtainable: [] },
  modes: ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'].map((id) => ({ id })),
});

describe('diffCatalogues', () => {
  it('lists what a new version adds and removes, per kind', () => {
    const d = diffCatalogues(cat(['A', 'B'], ['H1']), cat(['A', 'C'], ['H1', 'H2']));
    expect(d).toEqual({
      kits: { added: ['C'], removed: ['B'] },
      head: { added: ['H2'], removed: [] },
      clothes: { added: [], removed: [] },
      shoes: { added: [], removed: [] },
      modes: { added: [], removed: [] },
    });
    expect(describeDiff(d)).toBe('kits: +1 (C), -1 (B)\nhead: +1 (H2)');
  });

  it('says so when nothing changed', () => {
    expect(describeDiff(diffCatalogues(cat(['A'], []), cat(['A'], [])))).toBe(
      'no kits or gear added or removed',
    );
  });

  it('lists a mode the game adds or retires, which a removal refuses like a kit (failure 3)', () => {
    const before = cat(['A'], []);
    const after = { ...cat(['A'], []), modes: before.modes.filter((m) => m.id !== 'Tcl') };
    expect(diffCatalogues(before, after).modes).toEqual({ added: [], removed: ['Tcl'] });
    expect(removedIds(diffCatalogues(before, after))).toEqual(['Tcl']);
  });
});
