// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import messages from '../i18n/messages/en-US.json';
import { App } from '../App';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the run page', () => {
  it('tells the player once a save finds storage full, though it could read it on opening (not-kept-notice)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    render(<App locale="en-US" page="home" basePath="/" />);
    fireEvent.click(await screen.findByRole('button', { name: messages['start.roll'] }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(messages['storage.notKept']);
    expect(
      screen
        .getAllByRole('button', { name: messages['run.export'] })
        .some((b) => alert.contains(b)),
    ).toBe(true);
  });

  it('says nothing about storage when the browser keeps the run', async () => {
    render(<App locale="en-US" page="home" basePath="/" />);
    fireEvent.click(await screen.findByRole('button', { name: messages['start.roll'] }));
    await screen.findByRole('button', { name: messages['run.export'] });
    expect(screen.queryByText(messages['storage.notKept'])).toBeNull();
  });
});
