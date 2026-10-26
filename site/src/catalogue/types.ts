// The shape of a generated catalogue (site/src/catalogue/<version>/catalogue.json). Items are
// identified by the datamine's row id, which is what a saved run refers to. Their names are kept
// apart, one file per locale (names/<locale>.json), so a page loads only its own language's.
export type Item = { id: string; image: string };

// A gear piece also has its brand (gear-brand), by the game's id, so the player can find it in the
// game's shops. Not part of a share link: a link names pieces by their place.
export type GearItem = Item & { brand: string };

// site/src/catalogue/<version>/names/<locale>.json: every item's name, and the game file it is from.
export type NamesFile = { source: string; names: Record<string, string> };

export type Catalogue = {
  version: string;
  datamine: { repo: string; commit: string; dataFolder: string };
  kits: Item[];
  gear: { head: GearItem[]; clothes: GearItem[]; shoes: GearItem[] };
  // Every brand a piece in the catalogue wears, with its icon, named in names/<locale>.
  brands: Item[];
  // What the data had and the catalogue left out, kept so a reviewer can see why.
  excluded: { replicas: { id: string; copies: string }[]; unobtainable: string[] };
  // The modes a result is played in (match-modes), by the game's own ids, named in names/<locale>.
  modes: { id: string }[];
};

export const gearSlots = ['head', 'clothes', 'shoes'] as const;
export type GearSlot = (typeof gearSlots)[number];
