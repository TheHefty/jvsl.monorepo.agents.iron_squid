// What counts as a kit and as wearable gear, turned from the datamine's raw rows into the
// catalogue a run draws from (FR-1, FR-2); and each item's name in one of the game's languages
// (NFR-I3). Names come from the game's own text, never typed.
import type { Catalogue, GearSlot } from '../../src/catalogue/types';

type WeaponRow = { __RowId: string; Type?: string; SubWeapon?: string; SpecialWeapon?: string };
type GearRow = { __RowId: string; HowToGet?: string };

export type Source = {
  gameVersion: string;
  datamine: Catalogue['datamine'];
  weapons: WeaponRow[];
  gear: Record<GearSlot, GearRow[]>;
  names: Names;
};

// A language file of the game: message tables by name, each a map of key to text.
type Names = Record<string, Record<string, string>>;

const nameTables: Record<GearSlot, string> = {
  head: 'CommonMsg/Gear/GearName_Head',
  clothes: 'CommonMsg/Gear/GearName_Clothes',
  shoes: 'CommonMsg/Gear/GearName_Shoes',
};

// "Work/Gyml/Bomb_Suction.spl__WeaponInfoSub.gyml" -> "Bomb_Suction"
const part = (path = '') => path.split('/').pop()?.split('.')[0] ?? '';
const mainClass = (id: string) => id.slice(0, id.lastIndexOf('_'));
const numbered = (id: string) => /_\d+$/.test(id);

const gearKey = (id: string) => id.slice(id.indexOf('_') + 1);

// The six modes a result is played in (match-modes), in the order a player is offered them: Turf
// War, Splat Zones, Tower Control, Rainmaker, Clam Blitz, Tricolor Turf War. The game's ids; their
// "_2L" two-line variants are display forms, never used.
const modeIds = ['Pnt', 'Var', 'Vlf', 'Vgl', 'Vcl', 'Tcl'] as const;

export function buildCatalogue(source: Source): Catalogue {
  const versus = source.weapons.filter((w) => w.Type === 'Versus');
  const kitRows = versus.filter((w) => numbered(w.__RowId));

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
  const gearOf = (slot: GearSlot) =>
    source.gear[slot].flatMap((g) => {
      if (g.HowToGet === 'Impossible') {
        unobtainable.push(g.__RowId);
        return [];
      }
      return [{ id: g.__RowId, image: `gear/${g.__RowId}.png` }];
    });
  const gear = { head: gearOf('head'), clothes: gearOf('clothes'), shoes: gearOf('shoes') };

  return {
    version: source.gameVersion,
    datamine: source.datamine,
    kits: kitRows.map((k) => ({ id: k.__RowId, image: `weapon/Wst_${k.__RowId}.png` })),
    gear,
    excluded: { replicas, unobtainable },
    modes: modeIds.map((id) => ({ id })),
  };
}

// Every item's name in one language file of the game, by id. A missing one is refused, naming the
// item and the file: a blank or borrowed name would reach players with nothing failing.
export function buildNames(
  catalogue: Catalogue,
  names: Names,
  file: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (id: string, name: string | undefined) => {
    if (!name) throw new Error(`catalogue: ${id} has no name in ${file}`);
    out[id] = name;
  };
  const weaponNames = names['CommonMsg/Weapon/WeaponName_Main'] ?? {};
  for (const k of catalogue.kits) add(k.id, weaponNames[k.id]);
  for (const slot of ['head', 'clothes', 'shoes'] as const) {
    const table = names[nameTables[slot]] ?? {};
    for (const g of catalogue.gear[slot]) add(g.id, table[gearKey(g.id)]);
  }
  const modeNames = names['CommonMsg/VS/VSRuleName'] ?? {};
  for (const m of catalogue.modes) add(m.id, modeNames[m.id]);
  return out;
}
