import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import messages from '../../messages/en.json';
import {LivesMeter} from './LivesMeter';

function renderMeter(lives: number, max = 5) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LivesMeter lives={lives} max={max} />
    </NextIntlClientProvider>
  );
}

describe('LivesMeter', () => {
  it('states the count in text, not only as circles', () => {
    // `●●●○○` is announced as "black circle black circle…", which tells a
    // screen reader user nothing about how many lives are left.
    renderMeter(3);
    expect(screen.getByText('3 lives remaining')).toBeInTheDocument();
  });

  it('uses the singular for one life', () => {
    renderMeter(1);
    expect(screen.getByText('1 life remaining')).toBeInTheDocument();
  });

  it('hides the decorative marks from assistive technology', () => {
    const {container} = renderMeter(3);
    const marks = container.querySelector('.lives-marks');
    expect(marks).toHaveAttribute('aria-hidden', 'true');
    expect(marks).toHaveTextContent('●●●○○');
  });

  it('never renders negative or overflowing marks', () => {
    const {container} = renderMeter(0, 3);
    expect(container.querySelector('.lives-marks')).toHaveTextContent('○○○');
  });
});
