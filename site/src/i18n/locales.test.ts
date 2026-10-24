import { describe, expect, it } from 'vitest';
import { localeFromPath } from './locales';

describe('localeFromPath', () => {
  it('reads the locale from the first segment after the base', () => {
    expect(localeFromPath('/en-US/', '/')).toBe('en-US');
    expect(localeFromPath('/repo/en-US/run', '/repo/')).toBe('en-US');
  });

  it('has no locale for an address that does not name an offered one', () => {
    expect(localeFromPath('/', '/')).toBeUndefined();
    expect(localeFromPath('/xx-XX/', '/')).toBeUndefined();
    expect(localeFromPath('/en-US/', '/repo/')).toBeUndefined();
  });
});
