// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import messages from '../i18n/messages/en-US.json';
import published from '../catalogue/11.3.0/catalogue.json';
import type { Catalogue } from '../catalogue/types';
import { startRun } from '../run/engine';
import { cryptoSource } from '../run/random';
import { RUN_KEY } from '../run/storage';
import { encodeShare } from './link';

const catalogue = published as Catalogue;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.location.hash = '';
});

describe('the shared run page', () => {
  it('never writes the browser storage, not even the same value again (failure 1)', async () => {
    localStorage.setItem(RUN_KEY, '{"revision":1,"state":{}}');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const run = startRun(catalogue, { name: 'Someone else' }, cryptoSource, '2026-10-20T12:00:00Z');
    window.location.hash = encodeShare(run, catalogue);
    render(<App locale="en-US" messages={messages} page="shared" basePath="/" />);
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Someone else');
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
