// The locales the site is offered in. Every one has its own address (NFR-I8); the every-language
// epic adds the other fourteen.
export const locales = ['en-US'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en-US';

// The locale an address belongs to: the first path segment after the base, when it is offered.
export function localeFromPath(pathname: string, basePath: string): Locale | undefined {
  if (!pathname.startsWith(basePath)) return undefined;
  const segment = pathname.slice(basePath.length).split('/')[0];
  return locales.find((l) => l === segment);
}
