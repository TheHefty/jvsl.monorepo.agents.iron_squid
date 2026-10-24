// The shape of a generated catalogue (site/src/catalogue/<version>/catalogue.json). Items are
// identified by the datamine's row id, which is what a saved run refers to.
export type Item = { id: string; name: Record<string, string>; image: string };

export type Catalogue = {
  version: string;
  datamine: { repo: string; commit: string; dataFolder: string };
  kits: Item[];
  gear: { head: Item[]; clothes: Item[]; shoes: Item[] };
  // What the data had and the catalogue left out, kept so a reviewer can see why.
  excluded: { replicas: { id: string; copies: string }[]; unobtainable: string[] };
};

export const gearSlots = ['head', 'clothes', 'shoes'] as const;
export type GearSlot = (typeof gearSlots)[number];
