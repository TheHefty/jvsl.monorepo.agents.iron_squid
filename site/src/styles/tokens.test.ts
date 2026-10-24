import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Contrast is decided once, in the tokens (NFR-A6), for both themes (task visual-foundation,
// failure 1). The pairs are read from tokens.css itself, so a token changed there is checked here.
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]),
  );
}
const dark = tokens(css.slice(0, css.indexOf('@media')));
const light = { ...dark, ...tokens(css.slice(css.indexOf('@media'))) };

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

// Text and the grounds it sits on, at body size: 4.5:1 (WCAG 2.2 AA, 1.4.3).
const textPairs: [string, string][] = [
  ['color-text', 'color-bg'],
  ['color-text', 'color-surface'],
  ['color-text-muted', 'color-bg'],
  ['color-text-muted', 'color-surface'],
  ['color-accent-text', 'color-bg'],
  ['color-accent-text', 'color-surface'],
  ['color-on-ink', 'color-ink'],
  ['color-on-ink-muted', 'color-ink'],
  ['color-on-sticker', 'color-sticker'],
];
// Lines, outlines and marks: 3:1 (WCAG 2.2 AA, 1.4.11).
const markPairs: [string, string][] = [
  ['color-accent', 'color-bg'],
  ['color-accent', 'color-surface'],
];

describe.each([
  ['dark', dark],
  ['light', light],
])('the %s theme', (_name, t) => {
  it.each(textPairs)('%s on %s reaches 4.5:1', (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(markPairs)('%s on %s reaches 3:1', (fg, bg) => {
    expect(contrast(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(3);
  });
});
