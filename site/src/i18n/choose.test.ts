import { describe, expect, it } from 'vitest';
import { chooseLocale } from './choose';

const pick = (languages: string[], stored: string | null = null) => chooseLocale(stored, languages);

describe('chooseLocale', () => {
  it('takes a locale the site offers as it is', () => {
    expect(pick(['ja-JP'])).toBe('ja-JP');
    expect(pick(['ko-kr'])).toBe('ko-KR');
  });

  it('follows the order of the browser preferences', () => {
    expect(pick(['sv-SE', 'de-AT', 'en-US'])).toBe('de-DE');
  });

  it('falls back to en-US for a language the site does not offer', () => {
    expect(pick(['sv-SE', 'fi'])).toBe('en-US');
    expect(pick([])).toBe('en-US');
  });

  it('lets a remembered choice win over the browser, but only if the site offers it', () => {
    expect(pick(['ja-JP'], 'fr-CA')).toBe('fr-CA');
    expect(pick(['ja-JP'], 'xx-YY')).toBe('ja-JP');
  });

  // The regions a language is offered under (failure 2): the script and the region matter.
  it.each([
    ['pt-PT', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['zh', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-Hans-SG', 'zh-CN'],
    ['es-419', 'es-MX'],
    ['es-AR', 'es-MX'],
    ['es-CO', 'es-MX'],
    ['es-US', 'es-MX'],
    ['es', 'es-ES'],
    ['fr-CA', 'fr-CA'],
    ['fr-BE', 'fr-FR'],
    ['fr', 'fr-FR'],
    ['en-AU', 'en-GB'],
    ['en-IE', 'en-GB'],
    ['en-NZ', 'en-GB'],
    ['en-CA', 'en-US'],
    ['en', 'en-US'],
    ['de-CH', 'de-DE'],
    ['it-CH', 'it-IT'],
    ['nl-BE', 'nl-NL'],
    ['ru-UA', 'ru-RU'],
    ['ja', 'ja-JP'],
    ['ko', 'ko-KR'],
  ])('sends %s to %s', (preferred, locale) => {
    expect(pick([preferred])).toBe(locale);
  });
});
