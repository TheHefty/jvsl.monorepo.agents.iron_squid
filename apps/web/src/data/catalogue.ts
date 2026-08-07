import type {
  Catalogue,
  GearItem,
  GearSlot,
  MatchMode,
  Weapon
} from '@/domain/types';
import {gameDataLocale, type Locale} from '@/i18n/routing';

import catalogueData from './catalogue.json';
import type {CatalogueData, GameLocale, NameTable} from './source';

/**
 * Assembles the drawable catalogue for one locale.
 *
 * The generated data is split — `catalogue.json` holds ids and structure,
 * `names/<game locale>.json` holds the prose — so this is where the two meet.
 * The split is what keeps a sixth language from touching anything but its own
 * names file, and it is why `Catalogue` can stay exactly as the domain defines
 * it: the domain draws from ids and never reads a name.
 */

const data = catalogueData as CatalogueData;

/**
 * One loader per game locale, written out rather than built from a template.
 *
 * An explicit map means a typo is a type error instead of a module that fails
 * to resolve at request time.
 */
const NAME_LOADERS: Record<GameLocale, () => Promise<{default: NameTable}>> = {
  USen: () => import('./names/USen.json'),
  USes: () => import('./names/USes.json'),
  EUes: () => import('./names/EUes.json'),
  JPja: () => import('./names/JPja.json')
};

/** Loaded once per game locale. The data is immutable and identical per request. */
const cache = new Map<GameLocale, Promise<NameTable>>();

function names(locale: Locale): Promise<NameTable> {
  const gameLocale = gameDataLocale[locale];

  let loading = cache.get(gameLocale);
  if (!loading) {
    loading = NAME_LOADERS[gameLocale]().then((module) => module.default);
    cache.set(gameLocale, loading);
  }

  return loading;
}

function assemble(names: NameTable): Catalogue {
  const weapons: Weapon[] = data.weapons.map((weapon) => ({
    id: weapon.id,
    name: names.weapons[weapon.id],
    className: names.classes[weapon.className]
  }));

  const gear = {} as Record<GearSlot, GearItem[]>;
  for (const slot of Object.keys(data.gear) as GearSlot[]) {
    gear[slot] = data.gear[slot].map((id): GearItem => ({
      id,
      name: names.gear[id],
      slot
    }));
  }

  return {weapons, gear};
}

/**
 * The catalogue as the player's locale names it.
 *
 * `pt-BR` resolves to the English dataset: Splatoon 3 has no Portuguese
 * localisation, and inventing weapon names would be worse than leaving the
 * originals. That mapping lives in `i18n/routing.ts`, next to the locales.
 */
export function loadCatalogue(locale: Locale): Promise<Catalogue> {
  return names(locale).then(assemble);
}

/**
 * The four ranked modes, as Splatoon names them.
 *
 * Generated with the rest of the game data rather than written into the
 * message files, for the same reason weapon names are: these are the game's
 * nouns, and a player reading the log expects its words. Note the two Spanish
 * datasets genuinely disagree here — `Torre` against `Torreón`.
 */
export function loadModeNames(
  locale: Locale
): Promise<Record<MatchMode, string>> {
  return names(locale).then((table) => table.modes);
}

/** The game version the committed catalogue was generated from. */
export const gameVersion = data.gameVersion;
