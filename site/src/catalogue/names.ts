import { createContext, useContext, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import type { NamesFile } from './types';

// Every catalogue version's names in one locale, each file its own chunk, fetched only for the
// locale of the page (story localized-names): a page never downloads the other fourteen.
const loaders = import.meta.glob<NamesFile>('@catalogues/*/names/*.json', { import: 'default' });

// The name of an item of a catalogue version, in the page's locale.
export type ItemNames = (version: string, id: string) => string;

export async function loadNames(locale: string): Promise<ItemNames> {
  const own = Object.entries(loaders).filter(([path]) => path.endsWith(`/names/${locale}.json`));
  const byVersion = new Map(
    await Promise.all(
      own.map(
        async ([path, load]) =>
          [/([^/]+)\/names\//.exec(path)?.[1] ?? '', (await load()).names] as const,
      ),
    ),
  );
  return (version, id) => byVersion.get(version)?.[id] ?? '';
}

// Loads the page locale's names once; undefined until they arrive.
export function useLoadedNames(): ItemNames | undefined {
  const { locale } = useIntl();
  const [names, setNames] = useState<ItemNames>();
  useEffect(() => {
    let live = true;
    void loadNames(locale).then((loaded) => live && setNames(() => loaded));
    return () => {
      live = false;
    };
  }, [locale]);
  return names;
}

export const NamesContext = createContext<ItemNames>(() => '');
export const useItemNames = () => useContext(NamesContext);
