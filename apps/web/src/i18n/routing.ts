import {defineRouting} from 'next-intl/routing';

/**
 * The five locales Iron Squid ships.
 *
 * `pt-BR` is deliberately present even though Splatoon 3 has no Portuguese
 * localisation: the interface is translated, while weapon and gear names fall
 * back to their English originals. See docs/ARCHITECTURE.md in the monorepo —
 * inventing Portuguese names would be worse than not translating them.
 *
 * Spanish is carried twice because the two are genuinely different: 201 of 326
 * weapon names differ between the Latin American and European datasets.
 */
export const locales = ['en', 'pt-BR', 'es-419', 'es-ES', 'ja'] as const;

export type Locale = (typeof locales)[number];

/**
 * Which dataset each locale reads game nouns from. Several locales share one:
 * `pt-BR` has no official names of its own, and Splatoon's EU and US English
 * are identical across all 326 weapon names.
 */
export const gameDataLocale: Record<Locale, 'USen' | 'USes' | 'EUes' | 'JPja'> =
  {
    en: 'USen',
    'pt-BR': 'USen',
    'es-419': 'USes',
    'es-ES': 'EUes',
    ja: 'JPja'
  };

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  // Always prefix. The product is a link pasted into Discord: a URL whose
  // content depends on the reader's cookie renders differently for each of
  // them, caches wrong, and produces an unstable link preview.
  localePrefix: 'always'
});
