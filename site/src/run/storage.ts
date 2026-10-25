// Keeps the run in the browser (FR-14, FR-30), under one key, and nothing else (docs/RULES.md).
//
// The record is { revision, state }. A write names the revision it was based on and is refused if
// another tab wrote since, so two tabs cannot undo each other's results. A stored value this site
// cannot read is never overwritten unless the player confirmed it, so a run is never lost to a bug
// or a version mismatch. When storage is refused or full, the run carries on in memory and says it
// is not being kept; keep-progress tells the player.
import type { Catalogue } from '../catalogue/types';
import type { RunState } from './engine';
import { parseRun } from './parse';

export const RUN_KEY = 'iron-squid:run';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadResult =
  | { status: 'empty'; persistent?: false }
  | { status: 'ok'; state: RunState; revision: number; persistent: boolean }
  | {
      status: 'unreadable';
      reason: 'not-a-run' | 'unknown-schema' | 'unknown-catalogue';
      detail: string;
    };

export type SaveResult =
  | { ok: true; revision: number; persistent: boolean }
  | { ok: false; conflict: LoadResult }
  | { ok: false; unreadable: true };

type Record_ = { revision: number; state: RunState };

export function createRunStore(
  storage: StorageLike | undefined,
  catalogues: Record<string, Catalogue>,
) {
  let persistent = storage !== undefined;
  let memory: Record_ | undefined;
  const listeners: ((r: LoadResult) => void)[] = [];

  const read = (): string | null => {
    if (persistent && storage) {
      try {
        return storage.getItem(RUN_KEY);
      } catch {
        persistent = false;
      }
    }
    return memory ? JSON.stringify(memory) : null;
  };

  function load(): LoadResult {
    const raw = read();
    if (raw === null)
      return persistent ? { status: 'empty' } : { status: 'empty', persistent: false };
    let record: unknown;
    try {
      record = JSON.parse(raw);
    } catch {
      return {
        status: 'unreadable',
        reason: 'not-a-run',
        detail: 'the stored run is not valid JSON',
      };
    }
    const revision = (record as { revision?: unknown } | null)?.revision;
    if (!Number.isInteger(revision) || (revision as number) < 1) {
      return {
        status: 'unreadable',
        reason: 'not-a-run',
        detail: 'the stored run has no revision',
      };
    }
    const parsed = parseRun((record as { state?: unknown }).state, catalogues);
    if (!parsed.ok) return { status: 'unreadable', reason: parsed.reason, detail: parsed.detail };
    return { status: 'ok', state: parsed.state, revision: revision as number, persistent };
  }

  function save(
    state: RunState,
    basedOn: number,
    options: { replaceUnreadable?: boolean } = {},
  ): SaveResult {
    const current = load();
    if (current.status === 'unreadable' && !options.replaceUnreadable)
      return { ok: false, unreadable: true };
    const stored = current.status === 'ok' ? current.revision : 0;
    if (current.status === 'ok' && stored !== basedOn) return { ok: false, conflict: current };
    const record: Record_ = { revision: stored + 1, state };
    if (persistent && storage) {
      try {
        storage.setItem(RUN_KEY, JSON.stringify(record));
      } catch {
        persistent = false;
      }
    }
    memory = record;
    return { ok: true, revision: record.revision, persistent };
  }

  return {
    load,
    save,
    onExternalChange: (listener: (r: LoadResult) => void) => void listeners.push(listener),
    // Fed the browser's storage events: another tab wrote, or cleared, the run.
    storageEvent: (event: { key: string | null }) => {
      if (event.key !== RUN_KEY && event.key !== null) return;
      const result = load();
      for (const l of listeners) l(result);
    },
  };
}

export type RunStore = ReturnType<typeof createRunStore>;

// The page's own storage, or none when the browser refuses access to it outright.
export function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
