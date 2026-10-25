import { describe, expect, it } from 'vitest';
import { localeHref, LOCALE_KEY, rememberLocale } from './switch';

describe('localeHref', () => {
  it('keeps the page and swaps only the locale', () => {
    expect(localeHref('/en-US/terms/', '', '/', 'de-DE')).toBe('/de-DE/terms/');
    expect(localeHref('/repo/en-US/', '', '/repo/', 'ja-JP')).toBe('/repo/ja-JP/');
  });

  it('keeps a shared run, which travels after the "#" (language-switcher, failure 1)', () => {
    expect(localeHref('/en-US/run/', '#AQYxMS4z', '/', 'ko-KR')).toBe('/ko-KR/run/#AQYxMS4z');
  });

  it('sends a page outside any locale, such as a missing one, to the home page of the locale', () => {
    expect(localeHref('/nowhere', '', '/', 'fr-CA')).toBe('/fr-CA/');
  });
});

describe('rememberLocale', () => {
  it('keeps the choice under its own key, and says nothing when storage is refused', () => {
    const kept = new Map<string, string>();
    rememberLocale('fr-CA', { setItem: (k, v) => void kept.set(k, v) });
    expect(kept.get(LOCALE_KEY)).toBe('fr-CA');
    expect(() =>
      rememberLocale('fr-CA', {
        setItem: () => {
          throw new DOMException('refused', 'SecurityError');
        },
      }),
    ).not.toThrow();
  });
});
