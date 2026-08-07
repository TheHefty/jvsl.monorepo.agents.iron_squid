import {describe, expect, it} from 'vitest';
import {DEFAULT_PREFS, displayAttributes, type DisplayPrefs} from './display';

function prefs(overrides: Partial<DisplayPrefs> = {}): DisplayPrefs {
  return {...DEFAULT_PREFS, ...overrides};
}

describe('displayAttributes', () => {
  it('emits the theme and contrast the stylesheet keys off', () => {
    const attrs = displayAttributes(prefs({theme: 'light', contrast: 'high'}));
    expect(attrs['data-theme']).toBe('light');
    expect(attrs['data-contrast']).toBe('high');
  });

  it('omits data-motion when the reader has expressed no preference', () => {
    // Absent means "defer to prefers-reduced-motion"; present means the
    // in-site toggle overrides the OS in either direction.
    const attrs = displayAttributes(prefs({motion: 'system'}));
    expect(attrs).not.toHaveProperty('data-motion');
  });

  it.each([
    ['full', 'full'],
    ['reduced', 'reduced']
  ] as const)('emits data-motion=%s when chosen explicitly', (motion, out) => {
    const attrs = displayAttributes(prefs({motion}));
    expect(attrs['data-motion']).toBe(out);
  });

  it.each([
    ['small', '0.9375'],
    ['normal', '1'],
    ['large', '1.1875']
  ] as const)('maps text size %s to scale %s', (textSize, scale) => {
    const attrs = displayAttributes(prefs({textSize}));
    expect((attrs.style as Record<string, string>)['--text-scale']).toBe(scale);
  });

  it('defaults to the shapes marking, so state is not colour-only', () => {
    expect(DEFAULT_PREFS.weaponMark).toBe('shapes');
    expect(displayAttributes(DEFAULT_PREFS)['data-weapon-mark']).toBe('shapes');
  });
});
