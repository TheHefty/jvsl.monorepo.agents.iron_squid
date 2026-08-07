import {useTranslations} from 'next-intl';
import type {Weapon, WeaponState} from '@/lib/mock';

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

function code(name: string) {
  const parts = name.replace(/[^A-Za-z0-9 .'-]/g, '').split(/[\s-]+/);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

export function ArmoryGrid({
  weapons,
  columns = 7,
  showCode = true
}: {
  weapons: Weapon[];
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
