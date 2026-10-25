import { defaultLocale, locales, type Locale } from './locales';

// The locale a first visit lands on (NFR-I5): a remembered choice the site still offers; else the
// first browser preference the site offers, exactly or by language, with the region or script
// deciding where a language has two locales; else en-US.
export function chooseLocale(stored: string | null, preferences: readonly string[]): Locale {
  const offered = (l: string | null) => locales.find((o) => o.toLowerCase() === l?.toLowerCase());
  const remembered = offered(stored);
  if (remembered) return remembered;
  for (const preference of preferences) {
    const found = offered(preference) ?? byLanguage(preference);
    if (found) return found;
  }
  return defaultLocale;
}

// Latin American Spanish: es-419, and the regions where Spanish is spoken in the Americas.
const americas = new Set([
  '419',
  'MX',
  'US',
  'AR',
  'BO',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'GT',
  'HN',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
]);
const traditional = new Set(['HANT', 'TW', 'HK', 'MO']);
const british = new Set(['GB', 'IE', 'AU', 'NZ']);

function byLanguage(preference: string): Locale | undefined {
  const [language = '', ...rest] = preference.split('-');
  const tags = new Set(rest.map((t) => t.toUpperCase()));
  const has = (set: Set<string>) => [...tags].some((t) => set.has(t));
  switch (language.toLowerCase()) {
    case 'pt':
      return 'pt-BR';
    case 'zh':
      return has(traditional) ? 'zh-TW' : 'zh-CN';
    case 'es':
      return has(americas) ? 'es-MX' : 'es-ES';
    case 'fr':
      return tags.has('CA') ? 'fr-CA' : 'fr-FR';
    case 'en':
      return has(british) ? 'en-GB' : 'en-US';
    case 'de':
      return 'de-DE';
    case 'it':
      return 'it-IT';
    case 'nl':
      return 'nl-NL';
    case 'ru':
      return 'ru-RU';
    case 'ja':
      return 'ja-JP';
    case 'ko':
      return 'ko-KR';
    default:
      return undefined;
  }
}
