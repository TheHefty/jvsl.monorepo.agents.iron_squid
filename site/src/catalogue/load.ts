import { versionOf } from './latest';
import type { Catalogue } from './types';

// Every catalogue version the site was built with, each in its own chunk, loaded when a run needs
// it rather than on the first screen (NFR-P1).
const loaders = import.meta.glob<Catalogue>('@catalogues/*/catalogue.json', { import: 'default' });

export async function loadCatalogues(): Promise<Record<string, Catalogue>> {
  const entries = await Promise.all(
    Object.entries(loaders).map(async ([path, load]) => [versionOf(path), await load()] as const),
  );
  return Object.fromEntries(entries);
}

// Where a catalogue's image is served from (task game-images).
export const imageUrl = (version: string, image: string) =>
  `${import.meta.env.BASE_URL}game/${version}/${image}`;
