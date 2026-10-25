// The locales the site is offered in (NFR-I2): the 14 Splatoon 3 ships in, and pt-BR. Every one has
// its own address (NFR-I8).
export const locales = [
  'en-US',
  'en-GB',
  'es-ES',
  'es-MX',
  'fr-FR',
  'fr-CA',
  'de-DE',
  'it-IT',
  'nl-NL',
  'ru-RU',
  'ja-JP',
  'ko-KR',
  'zh-CN',
  'zh-TW',
  'pt-BR',
] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en-US';

// The locale an address belongs to: the first path segment after the base, when it is offered.
export function localeFromPath(pathname: string, basePath: string): Locale | undefined {
  if (!pathname.startsWith(basePath)) return undefined;
  const segment = pathname.slice(basePath.length).split('/')[0];
  return locales.find((l) => l === segment);
}
