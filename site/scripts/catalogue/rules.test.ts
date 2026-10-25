import { describe, expect, it } from 'vitest';
import { buildCatalogue, buildNames, type Source } from './rules';

const weapon = (id: string, sub: string, special: string, type = 'Versus') => ({
  __RowId: id,
  Type: type,
  SubWeapon: `Work/Gyml/${sub}.spl__WeaponInfoSub.gyml`,
  SpecialWeapon: `Work/Gyml/${special}.spl__WeaponInfoSpecial.gyml`,
});
const gear = (id: string, howToGet = 'Shop') => ({ __RowId: id, HowToGet: howToGet });

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
      head: [gear('Hed_AMB000'), gear('Hed_MSN000', 'Impossible')],
      clothes: [gear('Clt_AMB000', 'Catalog')],
      shoes: [gear('Shs_AMB000', 'Other'), gear('Shs_SDODR000', 'Impossible')],
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
    expect(c.gear.shoes).toEqual([{ id: 'Shs_AMB000', image: 'gear/Shs_AMB000.png' }]);
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
});
