// What counts as a kit and as wearable gear, turned from the datamine's raw rows into the
// catalogue a run draws from (FR-1, FR-2). Names come from the game's own text, never typed.
import type { Catalogue, GearSlot, Item } from '../../src/catalogue/types';

type WeaponRow = { __RowId: string; Type?: string; SubWeapon?: string; SpecialWeapon?: string };
type GearRow = { __RowId: string; HowToGet?: string };

export type Source = {
  gameVersion: string;
  datamine: Catalogue['datamine'];
  weapons: WeaponRow[];
  gear: Record<GearSlot, GearRow[]>;
  names: Record<string, Record<string, string>>;
};

const nameTables: Record<GearSlot, string> = {
  head: 'CommonMsg/Gear/GearName_Head',
  clothes: 'CommonMsg/Gear/GearName_Clothes',
  shoes: 'CommonMsg/Gear/GearName_Shoes',
};

// "Work/Gyml/Bomb_Suction.spl__WeaponInfoSub.gyml" -> "Bomb_Suction"
const part = (path = '') => path.split('/').pop()?.split('.')[0] ?? '';
const mainClass = (id: string) => id.slice(0, id.lastIndexOf('_'));
const numbered = (id: string) => /_\d+$/.test(id);

function named(id: string, name: string | undefined, image: string): Item {
  if (!name) throw new Error(`catalogue: ${id} has no en-US name in the game data`);
  return { id, name: { 'en-US': name }, image };
}

export function buildCatalogue(source: Source): Catalogue {
  const versus = source.weapons.filter((w) => w.Type === 'Versus');
  const kitRows = versus.filter((w) => numbered(w.__RowId));
  const weaponNames = source.names['CommonMsg/Weapon/WeaponName_Main'] ?? {};

  // A variant without a number is a replica only if it is the same weapon in play as a kit: same
  // main class, sub and special. Anything else is refused, because guessing either way breaks runs.
  const replicas = versus
    .filter((w) => !numbered(w.__RowId))
    .map((w) => {
      const twin = kitRows.find(
        (k) =>
          mainClass(k.__RowId) === mainClass(w.__RowId) &&
          part(k.SubWeapon) === part(w.SubWeapon) &&
          part(k.SpecialWeapon) === part(w.SpecialWeapon),
      );
      if (!twin) {
        throw new Error(
          `catalogue: ${w.__RowId} is not a numbered kit and copies no kit ` +
            `(sub ${part(w.SubWeapon)}, special ${part(w.SpecialWeapon)})`,
        );
      }
      return { id: w.__RowId, copies: twin.__RowId };
    });

  const unobtainable: string[] = [];
  const gearOf = (slot: GearSlot) => {
    const names = source.names[nameTables[slot]] ?? {};
    return source.gear[slot].flatMap((g) => {
      if (g.HowToGet === 'Impossible') {
        unobtainable.push(g.__RowId);
        return [];
      }
      const key = g.__RowId.slice(g.__RowId.indexOf('_') + 1);
      return [named(g.__RowId, names[key], `gear/${g.__RowId}.png`)];
    });
  };
  const gear = { head: gearOf('head'), clothes: gearOf('clothes'), shoes: gearOf('shoes') };

  return {
    version: source.gameVersion,
    datamine: source.datamine,
    kits: kitRows.map((k) =>
      named(k.__RowId, weaponNames[k.__RowId], `weapon/Wst_${k.__RowId}.png`),
    ),
    gear,
    excluded: { replicas, unobtainable },
  };
}
