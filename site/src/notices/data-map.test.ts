import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Catalogue } from '../catalogue/types';
import catalogue from '../run/fixtures/catalogue-0.0.1.json';
import { startRun } from '../run/engine';
import { cryptoSource } from '../run/random';
import { createRunStore } from '../run/storage';
import { storedInBrowser } from './data-map';

// The privacy notice is rendered from data-map.ts; these tests hold the site to it, so the notice
// cannot keep saying "only the run" after a change stores something else (task notices-pages,
// failure 1).
const declaredKeys = new Set(storedInBrowser.flatMap((item) => (item.key ? [item.key] : [])));

describe('what the site keeps in the browser', () => {
  it('is only what the privacy notice lists, when a run is kept', () => {
    const raw = new Map<string, string>();
    const storage = {
      getItem: (k: string) => raw.get(k) ?? null,
      setItem: (k: string, v: string) => void raw.set(k, v),
      removeItem: (k: string) => void raw.delete(k),
    };
    const store = createRunStore(storage, { '0.0.1': catalogue as Catalogue });
    store.save(
      startRun(catalogue as Catalogue, { name: 'Ivo' }, cryptoSource, '2026-10-25T00:00:00.000Z'),
      0,
    );
    expect([...raw.keys()].filter((k) => !declaredKeys.has(k))).toEqual([]);
  });

  it('names no storage key in the code that the privacy notice does not list', () => {
    const src = new URL('../', import.meta.url).pathname;
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)
            ? [join(dir, e.name)]
            : [],
      );
    const keys = files(src).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/['"`](iron-squid:[\w-]+)['"`]/g)].map((m) => m[1]),
    );
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((k) => !declaredKeys.has(k as string))).toEqual([]);
  });
});
