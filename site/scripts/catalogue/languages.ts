import type { Locale } from '../../src/i18n/locales';

// The game's language file each locale's names come from (story localized-names). pt-BR, which the
// game does not ship, uses the American English names (NFR-I3).
export const languageFiles: Record<Locale, string> = {
  'en-US': 'USen',
  'en-GB': 'EUen',
  'es-ES': 'EUes',
  'es-MX': 'USes',
  'fr-FR': 'EUfr',
  'fr-CA': 'USfr',
  'de-DE': 'EUde',
  'it-IT': 'EUit',
  'nl-NL': 'EUnl',
  'ru-RU': 'EUru',
  'ja-JP': 'JPja',
  'ko-KR': 'KRko',
  'zh-CN': 'CNzh',
  'zh-TW': 'TWzh',
  'pt-BR': 'USen',
};
