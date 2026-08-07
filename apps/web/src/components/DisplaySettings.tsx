'use client';

import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import {
  COOKIE_NAMES,
  type Contrast,
  type DisplayPrefs,
  type Motion,
  type TextSize,
  type Theme,
  type WeaponMark
} from '@/lib/display';

/**
 * The four user-controlled accessibility options, plus the theme switcher the
 * design puts in the nav.
 *
 * Each choice writes a cookie and updates the document attributes immediately.
 * The cookie is what makes the *next* server render correct — without it a
 * shared link would paint the wrong theme and then correct itself, which is the
 * one thing the public run page must not do.
 */

function persist(name: string, value: string) {
  // A year, path-wide, SameSite=Lax: this is a display preference, never a
  // credential, so it carries no other flags.
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}

export function DisplaySettings({initial}: {initial: DisplayPrefs}) {
  const t = useTranslations('settings');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [prefs, setPrefs] = useState(initial);

  function update<K extends keyof DisplayPrefs>(
    key: K,
    value: DisplayPrefs[K]
  ) {
    setPrefs((p) => ({...p, [key]: value}));
    persist(COOKIE_NAMES[key], value as string);

    // The cookie is the single source of truth, and the server owns the
    // attributes on <html>. Refreshing re-renders from it rather than poking
    // the DOM here, which would leave two places that decide what the theme is.
    startTransition(() => {
      router.refresh();
    });
  }

  function group<T extends string>(
    legend: string,
    name: string,
    value: T,
    options: {value: T; label: string}[],
    onChange: (v: T) => void
  ) {
    return (
      <fieldset className="field settings-group">
        <legend>{legend}</legend>
        <div className="seg">
          {options.map((o) => (
            <label className="seg-opt" key={o.value}>
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <details className="settings">
      <summary className="btn btn-secondary">{t('open')}</summary>
      <div className="settings-panel panel elev-md">
        <h2 className="settings-title">{t('heading')}</h2>

        {group<Theme>(
          t('theme'),
          'theme',
          prefs.theme,
          [
            {value: 'dark', label: t('themeDark')},
            {value: 'light', label: t('themeLight')}
          ],
          (v) => update('theme', v)
        )}

        {group<Contrast>(
          t('contrast'),
          'contrast',
          prefs.contrast,
          [
            {value: 'normal', label: t('contrastNormal')},
            {value: 'high', label: t('contrastHigh')}
          ],
          (v) => update('contrast', v)
        )}

        {group<Motion>(
          t('motion'),
          'motion',
          prefs.motion === 'system' ? 'full' : prefs.motion,
          [
            {value: 'full', label: t('motionFull')},
            {value: 'reduced', label: t('motionReduced')}
          ],
          (v) => update('motion', v)
        )}

        {group<TextSize>(
          t('textSize'),
          'text-size',
          prefs.textSize,
          [
            {value: 'small', label: t('textSmall')},
            {value: 'normal', label: t('textNormal')},
            {value: 'large', label: t('textLarge')}
          ],
          (v) => update('textSize', v)
        )}

        {group<WeaponMark>(
          t('shapes'),
          'weapon-mark',
          prefs.weaponMark,
          [
            {value: 'colour', label: t('shapesColour')},
            {value: 'shapes', label: t('shapesShapes')}
          ],
          (v) => update('weaponMark', v)
        )}
      </div>
    </details>
  );
}
