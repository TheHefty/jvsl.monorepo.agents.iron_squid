import {describe, expect, it} from 'vitest';

import {
  EXCLUDED_GEAR_FAMILIES,
  buildCatalogue,
  buildNames,
  gearFamilyOf,
  gearNameKey,
  isDrawableGear,
  isDrawableWeapon,
  weaponClassOf,
  type GearRow,
  type LanguageFile,
  type RawGameData,
  type WeaponRow
} from './source';

const weapon = (id: string, Id: number, Type = 'Versus'): WeaponRow => ({
  Id,
  Type,
  __RowId: id
});

const gear = (id: string, HowToGet = 'Shop'): GearRow => ({
  HowToGet,
  __RowId: id
});

const raw = (over: Partial<RawGameData> = {}): RawGameData => ({
  weapons: [weapon('Shooter_Short_00', 0)],
  gear: {
    head: [gear('Hed_CAP000')],
    clothes: [gear('Clt_JKT000')],
    shoes: [gear('Shs_BOT000')]
  },
  ...over
});

describe('weaponClassOf', () => {
  it('reads the class from the row id, not from any language file', () => {
    expect(weaponClassOf('Shooter_Short_00')).toBe('Shooter');
    expect(weaponClassOf('Maneuver_Normal_01')).toBe('Maneuver');
  });
});

describe('isDrawableWeapon', () => {
  it('keeps weapons playable in Versus', () => {
    expect(isDrawableWeapon(weapon('Shooter_Short_00', 0))).toBe(true);
  });

  it('drops every mode that is not Versus', () => {
    for (const type of ['Coop', 'Mission', 'Other', 'Rival']) {
      expect(isDrawableWeapon(weapon('Shooter_Short_00', 0, type))).toBe(false);
    }
  });

  it('drops the Side Order replicas, which end in _O', () => {
    expect(isDrawableWeapon(weapon('Brush_Normal_O', 10))).toBe(false);
  });

  it('keeps the Hero and Octo Shot replicas, which do not', () => {
    // The _O rule has to catch exactly eleven rows. `_H` and `_Oct` look like
    // near misses and are ordinary Versus weapons.
    expect(isDrawableWeapon(weapon('Shooter_Normal_H', 20))).toBe(true);
    expect(isDrawableWeapon(weapon('Shooter_Normal_Oct', 21))).toBe(true);
  });
});

describe('gearFamilyOf', () => {
  it('strips the slot prefix and the trailing digits', () => {
    expect(gearFamilyOf('head', 'Hed_AMB000')).toBe('AMB');
    expect(gearFamilyOf('head', 'Hed_SDODR200')).toBe('SDODR');
    expect(gearFamilyOf('shoes', 'Shs_BOT012')).toBe('BOT');
  });

  it('refuses a row id from another slot rather than mangling it', () => {
    expect(() => gearFamilyOf('head', 'Clt_JKT000')).toThrow(/does not belong/);
  });
});

describe('gearNameKey', () => {
  it('drops the slot prefix, because that is how names are keyed', () => {
    // Weapons join on the full row id and gear does not. Getting this wrong
    // yields a name table that is silently empty rather than an error.
    expect(gearNameKey('head', 'Hed_AMB000')).toBe('AMB000');
    expect(gearNameKey('clothes', 'Clt_TES010')).toBe('TES010');
  });
});

describe('isDrawableGear', () => {
  it('keeps gear that can be bought or earned', () => {
    for (const how of ['Shop', 'Catalog', 'Other', 'Uroko']) {
      expect(isDrawableGear('head', gear('Hed_CAP000', how))).toBe(true);
    }
  });

  it('drops gear that cannot be worn in Versus', () => {
    // Salmon Run uniforms and the original Hero Mode gear.
    expect(isDrawableGear('head', gear('Hed_COP001', 'Impossible'))).toBe(
      false
    );
    expect(isDrawableGear('shoes', gear('Shs_MSN302', 'Impossible'))).toBe(
      false
    );
  });

  it('keeps the replicas of gear whose originals are excluded', () => {
    expect(isDrawableGear('head', gear('Hed_MSN000'))).toBe(true);
    expect(isDrawableGear('head', gear('Hed_SDODR200'))).toBe(true);
  });

  it('drops amiibo gear, which needs a physical figure', () => {
    // Rule 3 forbids skipping a draw, so an unobtainable piece stalls the run.
    expect(EXCLUDED_GEAR_FAMILIES).toContain('AMB');
    expect(isDrawableGear('clothes', gear('Clt_AMB000'))).toBe(false);
  });
});

describe('buildCatalogue', () => {
  it('orders weapons by the game id, which groups them by class', () => {
    const built = buildCatalogue(
      raw({
        weapons: [
          weapon('Saber_Normal_00', 8000),
          weapon('Shooter_Short_00', 0),
          weapon('Blaster_Light_00', 200)
        ]
      })
    );

    expect(built.weapons.map((w) => w.id)).toEqual([
      'Shooter_Short_00',
      'Blaster_Light_00',
      'Saber_Normal_00'
    ]);
  });

  it('records the class alongside each weapon', () => {
    const built = buildCatalogue(raw());
    expect(built.weapons[0]).toEqual({
      id: 'Shooter_Short_00',
      className: 'Shooter'
    });
  });

  it('pins the game version it was generated from', () => {
    expect(buildCatalogue(raw()).gameVersion).toMatch(/^\d+$/);
  });

  it('carries no prose, so one file serves every language', () => {
    const serialised = JSON.stringify(buildCatalogue(raw()));
    expect(serialised).not.toMatch(/Splattershot|Splatshot/);
  });

  it('throws rather than emitting an empty roster', () => {
    // A source whose shape changed would otherwise produce a catalogue that
    // draws nothing, and the failure would surface as an EmptyPoolError in a
    // player's run instead of in the build.
    expect(() => buildCatalogue(raw({weapons: []}))).toThrow(/No weapons/);
  });

  it('throws rather than emitting an empty gear slot', () => {
    expect(() =>
      buildCatalogue(
        raw({
          gear: {
            head: [gear('Hed_AMB000')],
            clothes: [gear('Clt_JKT000')],
            shoes: [gear('Shs_BOT000')]
          }
        })
      )
    ).toThrow(/No head gear/);
  });
});

describe('buildNames', () => {
  const language: LanguageFile = {
    'CommonMsg/Weapon/WeaponName_Main': {Shooter_Short_00: 'Sploosh-o-matic'},
    'CommonMsg/Weapon/WeaponTypeName': {Shooter: 'Shooters'},
    'CommonMsg/Gear/GearName_Head': {CAP000: 'Backwards Cap'},
    'CommonMsg/Gear/GearName_Clothes': {JKT000: 'Blue Jacket'},
    'CommonMsg/Gear/GearName_Shoes': {BOT000: 'Red Boots'}
  };

  it('resolves weapons, classes and gear for one language', () => {
    const names = buildNames(buildCatalogue(raw()), language);

    expect(names.weapons).toEqual({Shooter_Short_00: 'Sploosh-o-matic'});
    expect(names.classes).toEqual({Shooter: 'Shooters'});
    expect(names.gear).toEqual({
      Hed_CAP000: 'Backwards Cap',
      Clt_JKT000: 'Blue Jacket',
      Shs_BOT000: 'Red Boots'
    });
  });

  it('keys gear by the full row id, so the three slots cannot collide', () => {
    const names = buildNames(buildCatalogue(raw()), language);
    expect(Object.keys(names.gear)).toEqual(
      expect.arrayContaining(['Hed_CAP000', 'Clt_JKT000', 'Shs_BOT000'])
    );
  });

  it('trims the stray whitespace the source ships on some names', () => {
    const untidy = {
      ...language,
      'CommonMsg/Gear/GearName_Head': {CAP000: 'Backwards Cap '}
    };
    const names = buildNames(buildCatalogue(raw()), untidy);
    expect(names.gear.Hed_CAP000).toBe('Backwards Cap');
  });

  it('treats a whitespace-only name as missing', () => {
    const blank = {
      ...language,
      'CommonMsg/Gear/GearName_Head': {CAP000: '   '}
    };
    expect(() => buildNames(buildCatalogue(raw()), blank)).toThrow(
      /Missing name/
    );
  });

  it('throws on a missing weapon name instead of shipping a blank', () => {
    const incomplete = {...language, 'CommonMsg/Weapon/WeaponName_Main': {}};
    expect(() => buildNames(buildCatalogue(raw()), incomplete)).toThrow(
      /Missing name/
    );
  });

  it('throws on a missing gear name', () => {
    const incomplete = {...language, 'CommonMsg/Gear/GearName_Head': {}};
    expect(() => buildNames(buildCatalogue(raw()), incomplete)).toThrow(
      /CAP000/
    );
  });

  it('throws when a whole message bucket is absent', () => {
    expect(() => buildNames(buildCatalogue(raw()), {})).toThrow(/Missing name/);
  });
});
