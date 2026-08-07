import {useTranslations} from 'next-intl';
import type {ArmoryEntry} from '@/domain/challenge';
import type {WeaponState} from '@/domain/types';

/**
 * The armory.
 *
 * The mocks render each weapon as `<div title="…">`, which is why this is a
 * component with opinions rather than a loop: `title` is not reliably announced
 * by screen readers and a bare div takes no focus, so the product's central
 * progress display was invisible to assistive technology.
 *
 * It is a list. Each item carries a real accessible name that includes the
 * state ("Splattershot, cleared"), so the state is never colour-only — and when
 * the shapes option is on, a symbol carries it visually too.
 *
 * The tiles are not focusable: 162 tab stops would make the page unusable by
 * keyboard, and nothing here is interactive. Screen readers reach them through
 * list navigation.
 */

const SYMBOL: Record<WeaponState, string> = {
  cleared: '✓',
  current: '▸',
  untouched: '·'
};

/**
 * The two-character badge on a tile.
 *
 * Latin names read best as initials — *Splattershot Jr.* as `SJ` — but a
 * Japanese name has no word breaks to take initials from, so it takes its
 * first two characters instead. An earlier version stripped everything outside
 * `[A-Za-z0-9]` and rendered every Japanese weapon as `?`; that worked only
 * because the placeholder roster was entirely ASCII.
 */
function code(name: string) {
  const chars = (s: string) => Array.from(s);
  const words = Array.from(name.matchAll(/[\p{L}\p{N}]+/gu), (m) => m[0]);

  if (words.length === 0) return chars(name).slice(0, 2).join('');

  // Initials only when the name opens with a Latin letter. A name that opens
  // with a digit keeps it — `.52 Gal` and `.96 Gal` are told apart by the
  // number, not by the `G`.
  if (words.length >= 2 && /^\p{Script=Latin}/u.test(words[0])) {
    return (chars(words[0])[0] + chars(words[1])[0]).toUpperCase();
  }

  return chars(words[0]).slice(0, 2).join('').toUpperCase();
}

export function ArmoryGrid({
  weapons,
  columns = 7,
  showCode = true
}: {
  weapons: ArmoryEntry[];
  columns?: number;
  showCode?: boolean;
}) {
  const t = useTranslations('armory');

  const stateLabel: Record<WeaponState, string> = {
    cleared: t('stateCleared'),
    current: t('stateCurrent'),
    untouched: t('stateUntouched')
  };

  return (
    <ul
      className="armory-grid"
      aria-label={t('listLabel', {total: weapons.length})}
      style={{['--armory-columns' as string]: String(columns)}}
    >
      {weapons.map((weapon) => (
        <li
          key={weapon.id}
          className="armory-tile"
          data-state={weapon.state}
          data-compact={showCode ? undefined : 'true'}
        >
          <span className="visually-hidden">
            {t('weaponState', {
              name: weapon.name,
              state: stateLabel[weapon.state]
            })}
          </span>
          <span aria-hidden="true" className="armory-tile-mark">
            <span className="armory-tile-symbol">{SYMBOL[weapon.state]}</span>
            {showCode ? (
              <span className="armory-tile-code">{code(weapon.name)}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
