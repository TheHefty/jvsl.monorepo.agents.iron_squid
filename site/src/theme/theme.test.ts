// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyTheme, storedTheme, storeTheme, THEME_KEY } from './theme';

describe('the theme choice', () => {
  it('is read back only when it is a theme the site has', () => {
    const kept = new Map<string, string>([[THEME_KEY, 'dark']]);
    expect(storedTheme({ getItem: (k) => kept.get(k) ?? null })).toBe('dark');
    kept.set(THEME_KEY, 'sepia');
    expect(storedTheme({ getItem: (k) => kept.get(k) ?? null })).toBeUndefined();
  });

  it('counts storage that cannot be read as no choice', () => {
    const refused = {
      getItem: () => {
        throw new DOMException('refused', 'SecurityError');
      },
    };
    expect(storedTheme(refused)).toBeUndefined();
    expect(() =>
      storeTheme('dark', {
        setItem: () => {
          throw new DOMException('refused', 'SecurityError');
        },
      }),
    ).not.toThrow();
  });

  it('is set on the root element, and removed to let the device decide', () => {
    const root = document.createElement('html');
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    applyTheme(undefined, root);
    expect(root.dataset.theme).toBeUndefined();
  });
});
