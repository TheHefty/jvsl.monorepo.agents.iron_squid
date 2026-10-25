// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import published from '../catalogue/11.3.0/catalogue.json';
import type { Catalogue } from '../catalogue/types';
import messages from '../i18n/messages/en-US.json';
import { startRun } from '../run/engine';
import { cryptoSource } from '../run/random';
import { ShareControls } from './ShareControls';

const catalogue = published as Catalogue;
const state = startRun(catalogue, { name: 'Ivo' }, cryptoSource, '2026-10-20T12:00:00Z');

function show() {
  render(
    <IntlProvider locale="en-US" messages={messages}>
      <ShareControls state={state} catalogue={catalogue} />
    </IntlProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stubNavigator = (patch: Partial<Navigator>) =>
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator), patch));

describe('the share controls', () => {
  it('show the link to copy by hand when the clipboard refuses it (failure 1)', async () => {
    stubNavigator({
      clipboard: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
    } as unknown as Partial<Navigator>);
    show();
    fireEvent.click(screen.getByRole('button', { name: messages['share.copy'] }));
    const field = await screen.findByLabelText(messages['share.copyByHand']);
    expect((field as HTMLInputElement).value).toMatch(
      /^http:\/\/localhost(:\d+)?\/en-US\/run\/#[\w-]+$/,
    );
    expect(screen.queryByText(messages['share.copied'])).toBeNull();
  });

  it('offer no Share button where the device has no share sheet (failure 3)', () => {
    stubNavigator({ share: undefined } as unknown as Partial<Navigator>);
    show();
    expect(screen.queryByRole('button', { name: messages['share.share'] })).toBeNull();
  });

  it('say nothing when the player closes the share sheet (failure 3)', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('closed', 'AbortError')));
    stubNavigator({ share } as unknown as Partial<Navigator>);
    show();
    // Clicked, then given time for the rejection to be handled and any update to render.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: messages['share.share'] }));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(share).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText(messages['share.copyByHand'])).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('show the link to copy by hand when the share sheet fails for another reason', async () => {
    stubNavigator({
      share: () => Promise.reject(new DOMException('no', 'NotAllowedError')),
    } as unknown as Partial<Navigator>);
    show();
    fireEvent.click(screen.getByRole('button', { name: messages['share.share'] }));
    expect(await screen.findByLabelText(messages['share.copyByHand'])).toBeTruthy();
  });
});
