import type {Catalogue, GearItem, GearSlot, Weapon} from '@/domain/types';
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

/** Built once per game locale. The data is immutable and identical per request. */
const cache = new Map<GameLocale, Promise<Catalogue>>();

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
  const gameLocale = gameDataLocale[locale];

  let built = cache.get(gameLocale);
  if (!built) {
    built = NAME_LOADERS[gameLocale]().then((module) =>
      assemble(module.default)
    );
    cache.set(gameLocale, built);
  }

  return built;
}

/** The game version the committed catalogue was generated from. */
export const gameVersion = data.gameVersion;
