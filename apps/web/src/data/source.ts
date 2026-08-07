// Type-only, and it has to stay that way: the generator runs this file under
// plain Node, which erases `import type` but cannot resolve the `@/` alias for
// a value import.
import type {GearSlot, MatchMode} from '@/domain/types';

/**
 * Turning Leanny/splat3 into the Iron Squid catalogue.
 *
 * Everything here is a pure transform over parsed JSON: no fetching, no
 * writing. The generator script (`scripts/generate-catalogue.mts`) is the shell
 * that does the I/O, so the rules about what counts as a weapon and what counts
 * as drawable gear can be unit-tested without a network.
 *
 * The output is split in two on purpose. `catalogue.json` carries ids and
 * structure and not one word of prose; the names live in a file per game
 * locale. The domain draws from ids alone, and a page assembles the two for the
 * locale it is rendering — so adding a sixth language costs one names file and
 * changes nothing else.
 */

/** The dataset version this catalogue was generated from. Pinned, not floating. */
export const GAME_VERSION = '1120';

export const SOURCE_REPO = 'Leanny/splat3';

/** Locales the game itself ships names in, which is not the same set as ours. */
export const GAME_LOCALES = ['USen', 'USes', 'EUes', 'JPja'] as const;

export type GameLocale = (typeof GAME_LOCALES)[number];

/** A row of `WeaponInfoMain.json`, reduced to the fields we actually read. */
export type WeaponRow = {
  Id: number;
  Type: string;
  __RowId: string;
};

/** A row of `GearInfoHead/Clothes/Shoes.json`, likewise. */
export type GearRow = {
  HowToGet: string;
  __RowId: string;
};

export type LanguageFile = Record<string, Record<string, string>>;

/** Where each slot's rows and names come from, and how the two join. */
export const GEAR_SOURCES: Record<
  GearSlot,
  {file: string; idPrefix: string; messageKey: string}
> = {
  head: {
    file: 'GearInfoHead.json',
    idPrefix: 'Hed_',
    messageKey: 'CommonMsg/Gear/GearName_Head'
  },
  clothes: {
    file: 'GearInfoClothes.json',
    idPrefix: 'Clt_',
    messageKey: 'CommonMsg/Gear/GearName_Clothes'
  },
  shoes: {
    file: 'GearInfoShoes.json',
    idPrefix: 'Shs_',
    messageKey: 'CommonMsg/Gear/GearName_Shoes'
  }
};

export const WEAPON_NAME_KEY = 'CommonMsg/Weapon/WeaponName_Main';
export const WEAPON_CLASS_KEY = 'CommonMsg/Weapon/WeaponTypeName';
export const MODE_NAME_KEY = 'CommonMsg/VS/VSRuleName';

/**
 * Our mode names against the game's own keys.
 *
 * Taken from the dataset rather than translated by hand: these are the game's
 * nouns, and a player reading the log expects the words Splatoon uses. The
 * bucket also holds `Pnt` (Turf War) and `_2L` line-broken variants, and we
 * want neither — Turf War does not count towards the challenge at all.
 */
export const MODE_KEYS: Record<MatchMode, string> = {
  splatZones: 'Var',
  towerControl: 'Vlf',
  rainmaker: 'Vgl',
  clamBlitz: 'Vcl'
};

/**
 * Gear families excluded from the draw, by the letters that open their row id.
 *
 * `AMB` is amiibo gear: 64 items that cannot be obtained without buying a
 * physical figure. Rule 3 forbids skipping a draw for any reason, so drawing a
 * piece the player has no way to acquire would stall a run on a constraint that
 * is not part of the challenge. Every other hard-to-get family stays in —
 * Splatfest, Salmon Run rewards and the Side Order replicas are all reachable
 * by playing.
 */
export const EXCLUDED_GEAR_FAMILIES: readonly string[] = ['AMB'];

/**
 * Row ids of the Side Order weapon replicas, which end in `_O`.
 *
 * They are playable in Side Order only, so they are not part of the roster.
 * Matching on the row id rather than the English name keeps the filter
 * independent of any language file.
 */
const SIDE_ORDER_SUFFIX = '_O';

/** `Shooter_Short_00` → `Shooter`. Also the key into `WeaponTypeName`. */
export function weaponClassOf(rowId: string): string {
  const [className] = rowId.split('_');
  if (!className) {
    throw new Error(`Weapon row id has no class prefix: ${rowId}`);
  }
  return className;
}

/** `Hed_AMB000` → `AMB`. The family is what the exclusion list matches on. */
export function gearFamilyOf(slot: GearSlot, rowId: string): string {
  const {idPrefix} = GEAR_SOURCES[slot];
  if (!rowId.startsWith(idPrefix)) {
    throw new Error(`Gear row id ${rowId} does not belong to slot ${slot}`);
  }
  const family = /^[A-Za-z]+/.exec(rowId.slice(idPrefix.length))?.[0];
  if (!family) {
    throw new Error(`Gear row id has no family: ${rowId}`);
  }
  return family;
}

/** `Hed_AMB000` → `AMB000`, which is how the language files key gear names. */
export function gearNameKey(slot: GearSlot, rowId: string): string {
  return rowId.slice(GEAR_SOURCES[slot].idPrefix.length);
}

/**
 * Every weapon playable in Versus, minus the Side Order replicas.
 *
 * Deliberately not a count: the previous implementation hardcoded 129 and went
 * stale the moment Splatoon 3 added weapons.
 */
export function isDrawableWeapon(row: WeaponRow): boolean {
  return row.Type === 'Versus' && !row.__RowId.endsWith(SIDE_ORDER_SUFFIX);
}

/**
 * Gear a player can obtain and wear in a Versus battle.
 *
 * `HowToGet: 'Impossible'` covers the Salmon Run work uniforms and the original
 * Hero Mode and Side Order gear — none of it wearable in Versus. Their
 * *replicas* are separate rows and stay in the pool.
 */
export function isDrawableGear(slot: GearSlot, row: GearRow): boolean {
  if (row.HowToGet === 'Impossible') return false;
  return !EXCLUDED_GEAR_FAMILIES.includes(gearFamilyOf(slot, row.__RowId));
}

/** Ids and structure. No prose, so it is the same file in every language. */
export type CatalogueData = {
  gameVersion: string;
  /** Ordered by the game's own weapon id, which groups them by class. */
  weapons: {id: string; className: string}[];
  gear: Record<GearSlot, string[]>;
};

/** One language's half of the catalogue. */
export type NameTable = {
  weapons: Record<string, string>;
  classes: Record<string, string>;
  gear: Record<string, string>;
  modes: Record<MatchMode, string>;
};

export type RawGameData = {
  weapons: WeaponRow[];
  gear: Record<GearSlot, GearRow[]>;
};

export function buildCatalogue(raw: RawGameData): CatalogueData {
  const weapons = raw.weapons
    .filter(isDrawableWeapon)
    // `Id` is unique and ascends through the classes in the order the game
    // lists them. `DebugDispOrder` looks like the obvious sort key and is not:
    // it repeats, so it cannot order the roster on its own.
    .sort((a, b) => a.Id - b.Id)
    .map((row) => ({id: row.__RowId, className: weaponClassOf(row.__RowId)}));

  if (weapons.length === 0) {
    throw new Error(
      'No weapons survived the filter; the source shape changed.'
    );
  }

  const gear = {} as Record<GearSlot, string[]>;
  for (const slot of Object.keys(GEAR_SOURCES) as GearSlot[]) {
    const ids = raw.gear[slot]
      .filter((row) => isDrawableGear(slot, row))
      .map((row) => row.__RowId)
      .sort();
    if (ids.length === 0) {
      throw new Error(`No ${slot} gear survived the filter.`);
    }
    gear[slot] = ids;
  }

  return {gameVersion: GAME_VERSION, weapons, gear};
}

/**
 * Looks up every name the catalogue needs in one language file.
 *
 * A missing name throws rather than falling back to the id or to an empty
 * string. A blank weapon name is the kind of fault that survives review and
 * surfaces in production, and the generator is exactly where it is cheap to
 * catch.
 */
export function buildNames(
  catalogue: CatalogueData,
  language: LanguageFile
): NameTable {
  const read = (bucket: string, key: string): string => {
    // Trimmed because the source has stray trailing spaces on eight names —
    // `Custom Painted F-3 `, `イカタコピアス ` and friends. Harmless in a
    // paragraph, visible once a name is centred in a tile or read aloud.
    const value = language[bucket]?.[key]?.trim();
    if (!value) {
      throw new Error(`Missing name: ${bucket} / ${key}`);
    }
    return value;
  };

  const weapons: Record<string, string> = {};
  const classes: Record<string, string> = {};
  for (const weapon of catalogue.weapons) {
    weapons[weapon.id] = read(WEAPON_NAME_KEY, weapon.id);
    classes[weapon.className] = read(WEAPON_CLASS_KEY, weapon.className);
  }

  const gear: Record<string, string> = {};
  for (const slot of Object.keys(GEAR_SOURCES) as GearSlot[]) {
    const {messageKey} = GEAR_SOURCES[slot];
    for (const id of catalogue.gear[slot]) {
      gear[id] = read(messageKey, gearNameKey(slot, id));
    }
  }

  const modes = {} as Record<MatchMode, string>;
  for (const mode of Object.keys(MODE_KEYS) as MatchMode[]) {
    modes[mode] = read(MODE_NAME_KEY, MODE_KEYS[mode]);
  }

  return {weapons, classes, gear, modes};
}
