/**
 * Display preferences — the pure half.
 *
 * Kept free of `next/headers` on purpose: the settings UI is a client
 * component and needs the cookie names and the scale table, so anything that
 * touches the request lives in `display.server.ts` instead. Importing server
 * APIs from here would drag them into the browser bundle.
 *
 * These live in cookies rather than localStorage because the pages are
 * server-rendered and the public run page exists to be shared: deriving the
 * theme on the client means every shared link paints the wrong theme and then
 * corrects itself. `prefers-color-scheme` supplies the default for a reader who
 * has never chosen, and nothing more.
 */

export const THEMES = ['dark', 'light'] as const;
export const MOTIONS = ['system', 'full', 'reduced'] as const;
export const CONTRASTS = ['normal', 'high'] as const;
export const TEXT_SIZES = ['small', 'normal', 'large'] as const;
export const WEAPON_MARKS = ['colour', 'shapes'] as const;

export type Theme = (typeof THEMES)[number];
export type Motion = (typeof MOTIONS)[number];
export type Contrast = (typeof CONTRASTS)[number];
export type TextSize = (typeof TEXT_SIZES)[number];
export type WeaponMark = (typeof WEAPON_MARKS)[number];

export type DisplayPrefs = {
  theme: Theme;
  motion: Motion;
  contrast: Contrast;
  textSize: TextSize;
  weaponMark: WeaponMark;
};

export const COOKIE_NAMES = {
  theme: 'is-theme',
  motion: 'is-motion',
  contrast: 'is-contrast',
  textSize: 'is-text-size',
  weaponMark: 'is-weapon-mark'
} as const;

export const DEFAULT_PREFS: DisplayPrefs = {
  theme: 'dark',
  motion: 'system',
  contrast: 'normal',
  // Defaults to carrying state by symbol as well as colour.
  weaponMark: 'shapes',
  textSize: 'normal'
};

export const TEXT_SCALE: Record<TextSize, string> = {
  small: '0.9375',
  normal: '1',
  large: '1.1875'
};

export function pickValue<T extends readonly string[]>(
  allowed: T,
  value: string | undefined,
  fallback: T[number]
): T[number] {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

/** The attributes and inline scale the stylesheet keys off. */
export function displayAttributes(prefs: DisplayPrefs) {
  return {
    'data-theme': prefs.theme,
    'data-contrast': prefs.contrast,
    ...(prefs.motion === 'system' ? {} : {'data-motion': prefs.motion}),
    'data-weapon-mark': prefs.weaponMark,
    style: {'--text-scale': TEXT_SCALE[prefs.textSize]} as React.CSSProperties
  };
}
