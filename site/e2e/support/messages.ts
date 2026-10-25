import { readFileSync } from 'node:fs';
import { IntlMessageFormat } from 'intl-messageformat';
import { defaultLocale, locales } from '../../src/i18n/locales';

// The site's own texts, in any locale, as the page formats them: steps compare a page with its own
// locale's catalogue, never with en-US's.
const catalogues = new Map<string, Record<string, string>>();

export function messageIn(locale: string, id: string, values: Record<string, unknown> = {}) {
  let catalogue = catalogues.get(locale);
  if (!catalogue) {
    catalogue = JSON.parse(readFileSync(`src/i18n/messages/${locale}.json`, 'utf8')) as Record<
      string,
      string
    >;
    catalogues.set(locale, catalogue);
  }
  const text = catalogue[id];
  if (text === undefined) throw new Error(`steps: ${locale} catalogue has no message "${id}"`);
  return String(new IntlMessageFormat(text, locale).format(values));
}

// The locale a page of the build is in: its first path segment, or the default for the root and
// the 404 page, which are written in it.
export function localeOfPage(path: string): string {
  const first = path.split('/')[0] ?? '';
  return (locales as readonly string[]).includes(first) ? first : defaultLocale;
}
