import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import published from '../../catalogue.versions.json';

// Every catalogue version ever published, which only grows: a run on any of them may still be in a
// player's browser, and a build without its folder would make that run unreadable (task
// older-catalogue, failure 3).
const folders = readdirSync('src/catalogue', { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

describe('the published catalogue versions', () => {
  it('are all still built: no version a run may be on has lost its folder', () => {
    expect(folders).toEqual(expect.arrayContaining(published));
  });

  it('list every version the site is built with, so each is kept from then on', () => {
    expect([...published].sort()).toEqual(folders);
  });
});
