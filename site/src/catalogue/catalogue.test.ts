import { describe, expect, it } from 'vitest';
import catalogue from './11.3.0/catalogue.json';
import english from './11.3.0/names/en-US.json';
import type { Catalogue } from './types';

// The generated 11.3.0 data, as committed. If the replica rule or the gear filter were wrong, every
// run for every player would be wrong with nothing failing (task catalogue-data, failure 1).
const c = catalogue as Catalogue;
const kitIds = new Set(c.kits.map((k) => k.id));

describe('the 11.3.0 catalogue', () => {
  it('has the 160 kits of game version 11.3.0', () => {
    expect(c.version).toBe('11.3.0');
    expect(c.kits).toHaveLength(160);
  });

  it('holds only numbered kits; every variant left out copies a kit that is in', () => {
    expect([...kitIds].filter((id) => !/_\d+$/.test(id))).toEqual([]);
    expect(c.excluded.replicas).toHaveLength(14);
    for (const r of c.excluded.replicas)
      expect(kitIds, `${r.id} copies ${r.copies}`).toContain(r.copies);
  });

  it('holds no gear that cannot be worn online', () => {
    const gearIds = new Set(Object.values(c.gear).flatMap((slot) => slot.map((g) => g.id)));
    expect(c.excluded.unobtainable.filter((id) => gearIds.has(id))).toEqual([]);
    // Hero Mode (MSN) and Side Order (SDODR) gear that exists only inside those modes is left out.
    expect(c.excluded.unobtainable.filter((id) => /_(MSN|SDODR)/.test(id)).length).toBeGreaterThan(
      0,
    );
  });

  it('keeps the Hero Mode and Side Order rewards a player can wear online', () => {
    const names = Object.values(c.gear).flatMap((slot) =>
      slot.map((g) => (english.names as Record<string, string>)[g.id]),
    );
    expect(names).toEqual(expect.arrayContaining(['Hero Headset Replica', 'Order Suit Replica']));
  });
});
