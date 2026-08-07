import 'server-only';
import {cookies} from 'next/headers';
import {
  CONTRASTS,
  COOKIE_NAMES,
  DEFAULT_PREFS,
  MOTIONS,
  TEXT_SIZES,
  THEMES,
  WEAPON_MARKS,
  pickValue,
  type DisplayPrefs
} from './display';

/**
 * Reads the display preferences off the request, so the very first HTML the
 * reader receives is already in the theme, contrast and text size they chose.
 */
export async function getDisplayPrefs(): Promise<DisplayPrefs> {
  const store = await cookies();
  const read = (name: string) => store.get(name)?.value;

  return {
    theme: pickValue(THEMES, read(COOKIE_NAMES.theme), DEFAULT_PREFS.theme),
    motion: pickValue(MOTIONS, read(COOKIE_NAMES.motion), DEFAULT_PREFS.motion),
    contrast: pickValue(
      CONTRASTS,
      read(COOKIE_NAMES.contrast),
      DEFAULT_PREFS.contrast
    ),
    textSize: pickValue(
      TEXT_SIZES,
      read(COOKIE_NAMES.textSize),
      DEFAULT_PREFS.textSize
    ),
    weaponMark: pickValue(
      WEAPON_MARKS,
      read(COOKIE_NAMES.weaponMark),
      DEFAULT_PREFS.weaponMark
    )
  };
}
