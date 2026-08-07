import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../messages/en.json';
import {ArmoryGrid} from './ArmoryGrid';
import type {ArmoryEntry} from '@/domain/challenge';

const weapons: ArmoryEntry[] = [
  {id: 'a', name: 'Splattershot', className: 'Shooter', state: 'cleared'},
  {id: 'b', name: 'Splat Roller', className: 'Roller', state: 'current'},
  {id: 'c', name: 'Splat Charger', className: 'Charger', state: 'untouched'}
];

function renderGrid(props: Parameters<typeof ArmoryGrid>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ArmoryGrid {...props} />
    </NextIntlClientProvider>
  );
}

describe('ArmoryGrid', () => {
  it('exposes the weapons as a labelled list', () => {
    renderGrid({weapons});

    const list = screen.getByRole('list', {
      name: 'All 3 weapons and their state'
    });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('names every weapon with its state, so state is never colour-only', () => {
    // The regression this pins: the design mocks carried state in fill colour
    // and the weapon name in a `title` attribute, which is not an accessible
    // name. A screen reader user could not tell cleared from untouched.
    renderGrid({weapons});

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Splattershot, cleared');
    expect(items[1]).toHaveTextContent('Splat Roller, up now');
    expect(items[2]).toHaveTextContent('Splat Charger, untouched');
  });

  it('does not rely on a title attribute for the weapon name', () => {
    const {container} = renderGrid({weapons});
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('marks each state with a distinct symbol as a second channel', () => {
    const {container} = renderGrid({weapons});
    const symbols = Array.from(
      container.querySelectorAll('.armory-tile-symbol')
    ).map((el) => el.textContent);

    expect(new Set(symbols).size).toBe(3);
  });

  it('keeps the tiles out of the tab order', () => {
    // 162 tab stops would make the page unusable by keyboard, and nothing in
    // the grid is interactive.
    const {container} = renderGrid({weapons});
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
    expect(container.querySelectorAll('a, button')).toHaveLength(0);
  });

  it('carries the state on a data attribute the stylesheet keys off', () => {
    const {container} = renderGrid({weapons});
    const states = Array.from(container.querySelectorAll('.armory-tile')).map(
      (el) => el.getAttribute('data-state')
    );
    expect(states).toEqual(['cleared', 'current', 'untouched']);
  });

  it('hides the code when rendered compact', () => {
    const {container} = renderGrid({weapons, showCode: false});
    expect(container.querySelectorAll('.armory-tile-code')).toHaveLength(0);
  });
});

describe('the tile code', () => {
  function codes(entries: ArmoryEntry[]) {
    const {container} = renderGrid({weapons: entries});
    return Array.from(container.querySelectorAll('.armory-tile-code')).map(
      (el) => el.textContent
    );
  }

  const entry = (name: string): ArmoryEntry => ({
    id: name,
    name,
    className: 'Shooters',
    state: 'untouched'
  });

  it('takes initials from a two-word Latin name', () => {
    expect(
      codes([entry('Splattershot Jr.'), entry('Neo Sploosh-o-matic')])
    ).toEqual(['SJ', 'NS']);
  });

  it('takes the first two characters of a single-word name', () => {
    expect(codes([entry('Squeezer')])).toEqual(['SQ']);
  });

  it('renders Japanese names rather than a question mark', () => {
    // The regression: the code stripped everything outside [A-Za-z0-9], so
    // every weapon in the Japanese catalogue rendered as `?`. It went unnoticed
    // because the placeholder roster it was written against was all ASCII.
    expect(
      codes([entry('ボールドマーカー'), entry('スプラシューター')])
    ).toEqual(['ボー', 'スプ']);
  });

  it('keeps accented Latin initials instead of dropping them', () => {
    expect(codes([entry('Élite Óptica')])).toEqual(['ÉÓ']);
  });

  it('keeps the number when a name leads with one', () => {
    // `.52 Gal` and `.96 Gal` are told apart by the digits, not by the `G`.
    expect(codes([entry('.52 Gal'), entry('.96 Gal')])).toEqual(['52', '96']);
  });
});
