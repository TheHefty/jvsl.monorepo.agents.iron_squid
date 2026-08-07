import {describe, expect, it} from 'vitest';

import {
  applyMatch,
  startChallenge,
  targetWeaponCount
} from '@/domain/challenge';
import {GEAR_SLOTS, MATCH_MODES, type Rng} from '@/domain/types';
import {locales} from '@/i18n/routing';

import {gameVersion, loadCatalogue, loadModeNames} from './catalogue';

/**
 * These run against the committed catalogue, not a fixture.
 *
 * That is the point: `source.test.ts` proves the transform is right, and this
 * proves the file actually in the repository is usable. Regenerating from a
 * source that changed shape would fail here.
 */

describe('the generated catalogue', () => {
  it('records the game version it came from', () => {
    expect(gameVersion).toMatch(/^\d+$/);
  });

  it('carries the full Versus roster', async () => {
    const catalogue = await loadCatalogue('en');
    // 162 at version 1120. Asserted as a floor rather than an equality so an
    // update that adds weapons is not a test failure — but a filter that
    // silently drops half the roster still is.
    expect(catalogue.weapons.length).toBeGreaterThanOrEqual(162);
  });

  it('has no duplicate weapon ids', async () => {
    const {weapons} = await loadCatalogue('en');
    expect(new Set(weapons.map((w) => w.id)).size).toBe(weapons.length);
  });

  it('has no duplicate gear ids, across slots as well as within', async () => {
    const {gear} = await loadCatalogue('en');
    const ids = GEAR_SLOTS.flatMap((slot) => gear[slot].map((g) => g.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tags every gear item with the slot it was filed under', async () => {
    const {gear} = await loadCatalogue('en');
    for (const slot of GEAR_SLOTS) {
      expect(gear[slot].every((item) => item.slot === slot)).toBe(true);
    }
  });

  it('can supply a full set of gear for every weapon in a run', async () => {
    // Single use is per item, so a complete run spends one piece per slot per
    // weapon. If the roster ever outgrew a gear pool, a run would become
    // impossible to finish and the failure would surface as an EmptyPoolError
    // in someone's last few draws.
    const catalogue = await loadCatalogue('en');
    const needed = targetWeaponCount(catalogue);

    for (const slot of GEAR_SLOTS) {
      expect(catalogue.gear[slot].length).toBeGreaterThanOrEqual(needed);
    }
  });
});

describe.each(locales)('names in %s', (locale) => {
  it('are present and non-blank for every weapon and class', async () => {
    const {weapons} = await loadCatalogue(locale);
    for (const weapon of weapons) {
      expect(weapon.name.trim()).not.toBe('');
      expect(weapon.className.trim()).not.toBe('');
    }
  });

  it('are present and non-blank for every piece of gear', async () => {
    const {gear} = await loadCatalogue(locale);
    for (const slot of GEAR_SLOTS) {
      for (const item of gear[slot]) {
        expect(item.name.trim()).not.toBe('');
      }
    }
  });
});

describe('mode names', () => {
  it('are complete in every locale', async () => {
    for (const locale of locales) {
      const modes = await loadModeNames(locale);
      expect(Object.keys(modes).sort()).toEqual([...MATCH_MODES].sort());
      expect(Object.values(modes).every((n) => n.trim() !== '')).toBe(true);
    }
  });

  it('differ between the two Spanish datasets', async () => {
    // `Torre` against `Torreón` — the same reason the locales are carried
    // separately at all.
    const [latam, spain] = await Promise.all([
      loadModeNames('es-419'),
      loadModeNames('es-ES')
    ]);
    expect(latam.towerControl).not.toBe(spain.towerControl);
  });
});

describe('locale mapping', () => {
  it('gives Japanese its own names', async () => {
    const [en, ja] = await Promise.all([
      loadCatalogue('en'),
      loadCatalogue('ja')
    ]);
    expect(ja.weapons[0].name).not.toBe(en.weapons[0].name);
  });

  it('separates the two Spanish datasets, which genuinely differ', async () => {
    const [latam, spain] = await Promise.all([
      loadCatalogue('es-419'),
      loadCatalogue('es-ES')
    ]);
    const differing = latam.weapons.filter(
      (w, i) => w.name !== spain.weapons[i].name
    );
    expect(differing.length).toBeGreaterThan(0);
  });

  it('falls back to English for pt-BR, which the game does not localise', async () => {
    const [en, ptBR] = await Promise.all([
      loadCatalogue('en'),
      loadCatalogue('pt-BR')
    ]);
    expect(ptBR.weapons.map((w) => w.name)).toEqual(
      en.weapons.map((w) => w.name)
    );
  });

  it('keeps the same ids in every locale, since the draw is language-blind', async () => {
    const [en, ja] = await Promise.all([
      loadCatalogue('en'),
      loadCatalogue('ja')
    ]);
    expect(ja.weapons.map((w) => w.id)).toEqual(en.weapons.map((w) => w.id));
  });
});

describe('driving the domain with real data', () => {
  const firstAvailable: Rng = () => 0;

  it('plays a complete challenge without exhausting a pool', async () => {
    const catalogue = await loadCatalogue('en');
    const total = targetWeaponCount(catalogue);

    let state = startChallenge(
      catalogue,
      firstAvailable,
      '2026-01-01T00:00:00Z'
    );
    for (let i = 0; i < total; i += 1) {
      state = applyMatch(state, catalogue, firstAvailable, {
        result: 'win',
        mode: 'splatZones',
        at: '2026-01-01T00:00:00Z'
      });
    }

    expect(state.status).toBe('complete');
    expect(state.run.cleared).toHaveLength(total);
  });
});
