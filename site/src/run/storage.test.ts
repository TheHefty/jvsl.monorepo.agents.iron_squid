import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import { reportWin, startRun, type RunState } from './engine';
import catalogue from './fixtures/catalogue-0.0.1.json';
import { cryptoSource } from './random';
import { browserStorage, createRunStore, RUN_KEY, type StorageLike } from './storage';

const catalogues = { '0.0.1': catalogue as Catalogue };
const at = '2026-10-24T12:00:00.000Z';
const newRun = () => startRun(catalogue as Catalogue, { name: undefined }, cryptoSource, at);
const win = (s: RunState) => reportWin(s, { step: s.step, at });

// One storage shared by every store made on it, as tabs of one browser share localStorage.
function sharedStorage(): StorageLike & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => void raw.set(k, v),
    removeItem: (k) => void raw.delete(k),
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  removeItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
};

describe('a run store', () => {
  it('has no run in a fresh browser', () => {
    expect(createRunStore(sharedStorage(), catalogues).load()).toEqual({ status: 'empty' });
  });

  it('keeps a run across loads, under one key, with nothing else stored', () => {
    const storage = sharedStorage();
    const run = newRun();
    expect(createRunStore(storage, catalogues).save(run, 0)).toEqual({
      ok: true,
      revision: 1,
      persistent: true,
    });
    expect(createRunStore(storage, catalogues).load()).toEqual({
      status: 'ok',
      state: run,
      revision: 1,
      persistent: true,
    });
    expect([...storage.raw.keys()]).toEqual([RUN_KEY]);
  });

  it('refuses a write from a tab that has fallen behind, and hands it the stored run (failure 1)', () => {
    const storage = sharedStorage();
    const run = newRun();
    const tabA = createRunStore(storage, catalogues);
    const tabB = createRunStore(storage, catalogues);
    tabA.save(run, 0);
    const won = win(run);
    expect(tabA.save(won, 1)).toMatchObject({ ok: true, revision: 2 });
    // Tab B still shows revision 1 and tries to write its own change.
    const result = tabB.save(win(run), 1);
    expect(result).toEqual({
      ok: false,
      conflict: { status: 'ok', state: won, revision: 2, persistent: true },
    });
    expect(JSON.parse(storage.raw.get(RUN_KEY) ?? '').revision).toBe(2);
  });

  it.each([
    ['text that is not JSON', '{"revision": 1, "state": ', 'not-a-run'],
    [
      'a run in a format the site does not read',
      JSON.stringify({ revision: 1, state: { schema: 99 } }),
      'unknown-schema',
    ],
    [
      'a run on a catalogue the site does not carry',
      JSON.stringify({ revision: 1, state: { schema: 1, catalogueVersion: '9.9.9' } }),
      'unknown-catalogue',
    ],
    ['a record with no revision', JSON.stringify({ state: {} }), 'not-a-run'],
  ])(
    'never overwrites %s, and says why it cannot be read (failure 2)',
    (_label, stored, reason) => {
      const storage = sharedStorage();
      storage.setItem(RUN_KEY, stored);
      const store = createRunStore(storage, catalogues);
      expect(store.load()).toMatchObject({ status: 'unreadable', reason });
      expect(store.save(newRun(), 0)).toEqual({ ok: false, unreadable: true });
      expect(storage.raw.get(RUN_KEY)).toBe(stored);
    },
  );

  it('overwrites an unreadable run only when asked to, after the player confirmed', () => {
    const storage = sharedStorage();
    storage.setItem(RUN_KEY, 'garbage');
    const run = newRun();
    expect(
      createRunStore(storage, catalogues).save(run, 0, { replaceUnreadable: true }),
    ).toMatchObject({ ok: true });
    expect(createRunStore(storage, catalogues).load()).toMatchObject({ status: 'ok', state: run });
  });

  it('keeps the run in memory when storage is refused, and says it is not being kept (failure 3)', () => {
    const store = createRunStore(throwing, catalogues);
    expect(store.load()).toEqual({ status: 'empty', persistent: false });
    const run = newRun();
    expect(store.save(run, 0)).toEqual({ ok: true, revision: 1, persistent: false });
    expect(store.load()).toEqual({ status: 'ok', state: run, revision: 1, persistent: false });
  });

  it('keeps the run in memory when storage is full', () => {
    const storage = sharedStorage();
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const store = createRunStore(storage, catalogues);
    const run = newRun();
    expect(store.save(run, 0)).toEqual({ ok: true, revision: 1, persistent: false });
    expect(store.load()).toMatchObject({ status: 'ok', state: run, persistent: false });
  });

  it('tells a tab when another tab changed the run', () => {
    const storage = sharedStorage();
    const tabA = createRunStore(storage, catalogues);
    const tabB = createRunStore(storage, catalogues);
    const seen: unknown[] = [];
    tabB.onExternalChange((result) => seen.push(result));
    const run = newRun();
    tabA.save(run, 0);
    tabB.storageEvent({ key: RUN_KEY });
    tabB.storageEvent({ key: 'something-else' });
    expect(seen).toEqual([{ status: 'ok', state: run, revision: 1, persistent: true }]);
  });
});

describe('the browser storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is none when the browser throws on reaching it, not only on using it (not-kept-notice, failure 1)', () => {
    const blocked = {};
    Object.defineProperty(blocked, 'localStorage', {
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    vi.stubGlobal('window', blocked);
    expect(browserStorage()).toBeUndefined();
    expect(createRunStore(browserStorage(), catalogues).load()).toEqual({
      status: 'empty',
      persistent: false,
    });
  });
});
