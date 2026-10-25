import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import published from '../../catalogue.versions.json';
import { catalogueOrderDigest } from './order';
import type { Catalogue } from './types';

// Every catalogue version ever published, with the digest of its items in order. The list only
// grows: a run on any version may still be in a player's browser (task older-catalogue, failure 3),
// and a share link names items by their place in that version's lists, so regenerating a version
// in another order would change every link made before (task share-codec, failure 3).
const versions: Record<string, string> = published;
const folders = readdirSync('src/catalogue', { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
const read = (v: string) =>
  JSON.parse(readFileSync(`src/catalogue/${v}/catalogue.json`, 'utf8')) as Catalogue;

describe('the published catalogue versions', () => {
  it('are all still built: no version a run may be on has lost its folder', () => {
    expect(folders).toEqual(expect.arrayContaining(Object.keys(versions)));
  });

  it('list every version the site is built with, so each is kept from then on', () => {
    expect(Object.keys(versions).sort()).toEqual(folders);
  });

  it('keep their items in the order they were published in', () => {
    for (const [version, digest] of Object.entries(versions)) {
      expect(catalogueOrderDigest(read(version)), version).toBe(digest);
    }
  });
});

describe('the order digest', () => {
  it('changes when two items swap places, and not when a name is translated', () => {
    const c = read('11.3.0');
    const base = catalogueOrderDigest(c);
    const [a, b] = c.gear.head;
    if (!a || !b) throw new Error('test: too few head pieces');
    const translated = structuredClone(c);
    (translated.kits[0] as { name: Record<string, string> }).name['ja-JP'] = 'テスト';
    expect(catalogueOrderDigest(translated)).toBe(base);
    const swapped = structuredClone(c);
    swapped.gear.head.splice(0, 2, b, a);
    expect(catalogueOrderDigest(swapped)).not.toBe(base);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
  });
});
