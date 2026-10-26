import { describe, expect, it } from 'vitest';
import { catalogueOrderDigest } from '../../src/catalogue/order';
import { buildCatalogue, buildNames, type Source } from './rules';

const weapon = (id: string, sub: string, special: string, type = 'Versus') => ({
  __RowId: id,
  Type: type,
  SubWeapon: `Work/Gyml/${sub}.spl__WeaponInfoSub.gyml`,
  SpecialWeapon: `Work/Gyml/${special}.spl__WeaponInfoSpecial.gyml`,
});
const gear = (id: string, howToGet = 'Shop', brand = 'B01') => ({
  __RowId: id,
  HowToGet: howToGet,
  Brand: brand,
});

function source(overrides: Partial<Source> = {}): Source {
  return {
    gameVersion: '11.3.0',
    datamine: { repo: 'Leanny/splat3', commit: 'abc', dataFolder: '1130' },
    weapons: [
      weapon('Shooter_Normal_00', 'Bomb_Suction', 'SpUltraShot'),
      weapon('Shooter_Normal_01', 'Bomb_Splash', 'SpTripleTornado'),
      weapon('Shooter_Normal_H', 'Bomb_Suction', 'SpUltraShot'),
      weapon('Shooter_Normal_S', 'Bomb_Splash', 'SpTripleTornado'),
      weapon('Shooter_Normal_Coop', 'Bomb_Suction', 'SpUltraShot', 'Coop'),
    ],
    gear: {
      head: [gear('Hed_AMB000', 'Shop', 'B10'), gear('Hed_MSN000', 'Impossible', 'None')],
      clothes: [gear('Clt_AMB000', 'Catalog', 'B00')],
      shoes: [gear('Shs_AMB000', 'Other', 'B10'), gear('Shs_SDODR000', 'Impossible', 'None')],
    },
    names: {
      'CommonMsg/Weapon/WeaponName_Main': {
        Shooter_Normal_00: 'Splattershot',
        Shooter_Normal_01: 'Tentatek Splattershot',
        Shooter_Normal_H: 'Hero Shot Replica',
        Shooter_Normal_S: 'Plastic-Bottle Shot Replica',
      },
      'CommonMsg/Gear/GearName_Head': { AMB000: 'Squid Hairclip', MSN000: 'Hero Headset' },
      'CommonMsg/Gear/GearName_Clothes': { AMB000: 'School Uniform A' },
      'CommonMsg/Gear/GearName_Shoes': { AMB000: 'School Shoes', SDODR000: 'Side Order shoes' },
      'CommonMsg/Gear/GearBrandName': { B00: 'SquidForce', B01: 'Zink', B10: 'Zekko' },
      'CommonMsg/VS/VSRuleName': {
        Pnt: 'Turf War',
        Pnt_2L: 'Turf\nWar',
        Var: 'Splat Zones',
        Vlf: 'Tower Control',
        Vgl: 'Rainmaker',
        Vcl: 'Clam Blitz',
        Tcl: 'Tricolor Turf War',
      },
    },
    ...overrides,
  };
}

describe('buildCatalogue', () => {
  it('keeps every versus kit with a numeric suffix, with its image', () => {
    const { kits } = buildCatalogue(source());
    expect(kits).toEqual([
      { id: 'Shooter_Normal_00', image: 'weapon/Wst_Shooter_Normal_00.png' },
      { id: 'Shooter_Normal_01', image: 'weapon/Wst_Shooter_Normal_01.png' },
    ]);
  });

  it('leaves out replicas, recording the kit each one copies', () => {
    expect(buildCatalogue(source()).excluded.replicas).toEqual([
      { id: 'Shooter_Normal_H', copies: 'Shooter_Normal_00' },
      { id: 'Shooter_Normal_S', copies: 'Shooter_Normal_01' },
    ]);
  });

  it('refuses a non-numeric variant that copies no kit, rather than guessing', () => {
    const s = source();
    s.weapons.push(weapon('Shooter_Normal_X', 'Bomb_Robot', 'SpJetpack'));
    expect(() => buildCatalogue(s)).toThrow(
      'catalogue: Shooter_Normal_X is not a numbered kit and copies no kit (sub Bomb_Robot, special SpJetpack)',
    );
  });

  it('keeps the gear a player can wear online, and records what it left out', () => {
    const c = buildCatalogue(source());
    expect(c.gear.head.map((g) => g.id)).toEqual(['Hed_AMB000']);
    expect(c.gear.shoes).toEqual([
      { id: 'Shs_AMB000', image: 'gear/Shs_AMB000.png', brand: 'B10' },
    ]);
    expect(c.excluded.unobtainable).toEqual(['Hed_MSN000', 'Shs_SDODR000']);
  });

  it('names every kit and piece from one language file of the game (NFR-I3)', () => {
    const s = source();
    expect(buildNames(buildCatalogue(s), s.names, 'data/language/USen.json')).toEqual({
      Shooter_Normal_00: 'Splattershot',
      Shooter_Normal_01: 'Tentatek Splattershot',
      Hed_AMB000: 'Squid Hairclip',
      Clt_AMB000: 'School Uniform A',
      Shs_AMB000: 'School Shoes',
      B00: 'SquidForce',
      B10: 'Zekko',
      Pnt: 'Turf War',
      Var: 'Splat Zones',
      Vlf: 'Tower Control',
      Vgl: 'Rainmaker',
      Vcl: 'Clam Blitz',
      Tcl: 'Tricolor Turf War',
    });
  });

  it('refuses an item with no name in a language file, naming both', () => {
    const s = source();
    s.names['CommonMsg/Gear/GearName_Clothes'] = {};
    expect(() => buildNames(buildCatalogue(s), s.names, 'data/language/JPja.json')).toThrow(
      'catalogue: Clt_AMB000 has no name in data/language/JPja.json',
    );
  });

  it('says where the data came from', () => {
    const c = buildCatalogue(source());
    expect(c.version).toBe('11.3.0');
    expect(c.datamine).toEqual({ repo: 'Leanny/splat3', commit: 'abc', dataFolder: '1130' });
  });

  it('lists the six modes a result can be played in, in a fixed order (match-modes)', () => {
    expect(buildCatalogue(source()).modes.map((m) => m.id)).toEqual([
      'Pnt',
      'Var',
      'Vlf',
      'Vgl',
      'Vcl',
      'Tcl',
    ]);
  });

  it("names the modes from the game's own words, never its two-line variants", () => {
    const s = source();
    const names = buildNames(buildCatalogue(s), s.names, 'data/language/USen.json');
    expect([names.Pnt, names.Tcl]).toEqual(['Turf War', 'Tricolor Turf War']);
    expect(Object.values(names).some((n) => n.includes('\n'))).toBe(false);
  });

  it('refuses a mode with no name in a language file, naming both', () => {
    const s = source();
    delete s.names['CommonMsg/VS/VSRuleName']?.Vgl;
    expect(() => buildNames(buildCatalogue(s), s.names, 'data/language/KRko.json')).toThrow(
      'catalogue: Vgl has no name in data/language/KRko.json',
    );
  });

  it('gives every piece its brand, and lists each brand worn once, with its icon (gear-brand)', () => {
    const c = buildCatalogue(source());
    expect(c.gear.head[0]?.brand).toBe('B10');
    expect(c.gear.clothes[0]?.brand).toBe('B00');
    expect(c.brands).toEqual([
      { id: 'B00', image: 'brand/B00.png' },
      { id: 'B10', image: 'brand/B10.png' },
    ]);
  });

  it('refuses a piece a player can wear that has no brand, naming it (brand-catalogue, failure 3)', () => {
    for (const brand of ['None', '', undefined]) {
      const s = source();
      s.gear.clothes = [{ __RowId: 'Clt_AMB000', HowToGet: 'Catalog', Brand: brand }];
      expect(() => buildCatalogue(s), String(brand)).toThrow('catalogue: Clt_AMB000 has no brand');
    }
  });

  it('refuses a brand with no name in a language file, naming both', () => {
    const s = source();
    delete s.names['CommonMsg/Gear/GearBrandName']?.B10;
    expect(() => buildNames(buildCatalogue(s), s.names, 'data/language/EUde.json')).toThrow(
      'catalogue: B10 has no name in data/language/EUde.json',
    );
  });

  it('leaves the order of the items as it was: brands are not in a share link (failure 1)', () => {
    const c = buildCatalogue(source());
    const without = {
      ...c,
      gear: {
        head: c.gear.head.map(({ id, image }) => ({ id, image })),
        clothes: c.gear.clothes.map(({ id, image }) => ({ id, image })),
        shoes: c.gear.shoes.map(({ id, image }) => ({ id, image })),
      },
      brands: [],
    } as unknown as typeof c;
    expect(catalogueOrderDigest(c)).toBe(catalogueOrderDigest(without));
  });
});
