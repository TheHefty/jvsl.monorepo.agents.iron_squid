import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../messages/en.json';
import {ArmoryGrid} from './ArmoryGrid';
import type {Weapon} from '@/lib/mock';

const weapons: Weapon[] = [
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
