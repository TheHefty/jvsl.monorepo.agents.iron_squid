import { localeFromPath, type Locale } from './locales';

// Where a visitor's language choice is kept (NFR-I5); the data map already lists it.
export const LOCALE_KEY = 'iron-squid:locale';

// The same page in another locale, with the fragment kept, so a shared run stays open (NFR-I8). A
// page outside any locale (a missing one) leads to the locale's home page.
export function localeHref(
  pathname: string,
  hash: string,
  basePath: string,
  target: Locale,
): string {
  const current = localeFromPath(pathname, basePath);
  if (!current) return `${basePath}${target}/`;
  return `${basePath}${target}${pathname.slice(basePath.length + current.length)}${hash}`;
}

// Remembers the choice for the site's root (task root-language); a browser that refuses storage
// keeps none, and the choice still applies to this visit through its address.
export function rememberLocale(locale: Locale, storage: Pick<Storage, 'setItem'> | undefined) {
  try {
    storage?.setItem(LOCALE_KEY, locale);
  } catch {
    // Not kept: the root will fall back to the browser's language.
  }
}
