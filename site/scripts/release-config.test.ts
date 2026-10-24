import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// release-please writes the version into every file listed here. If one is missing from the list,
// or the list names a file or path that does not exist, the versions drift apart silently.
const root = new URL('../../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const config = json('release-please-config.json');
const manifest = json('.release-please-manifest.json') as Record<string, string>;

describe('release-please configuration', () => {
  it('releases one package, at the repository root, as a simple release', () => {
    expect(Object.keys(config.packages)).toEqual(['.']);
    expect(config.packages['.']['release-type']).toBe('simple');
    expect(Object.keys(manifest)).toEqual(['.']);
  });

  it('keeps the site package and its lockfile at the released version', () => {
    const version = manifest['.'];
    expect(json('site/package.json').version).toBe(version);
    const lock = json('site/package-lock.json');
    expect(lock.version).toBe(version);
    expect(lock.packages[''].version).toBe(version);
  });

  it('names every place the version lives, and only places that exist', () => {
    const files = config.packages['.']['extra-files'] as { path: string; jsonpath: string }[];
    expect(files).toEqual([
      { type: 'json', path: 'site/package.json', jsonpath: '$.version' },
      { type: 'json', path: 'site/package-lock.json', jsonpath: '$.version' },
      { type: 'json', path: 'site/package-lock.json', jsonpath: "$.packages[''].version" },
    ]);
  });

  it('starts at 0.1.0 and stays in 0.x until 1.0.0 is chosen on purpose', () => {
    const pkg = config.packages['.'];
    expect(pkg['initial-version']).toBe('0.1.0');
    // Before 1.0.0, a feat bumps the minor and a breaking change does too, never the major.
    expect(pkg['bump-minor-pre-major']).toBe(true);
    expect(pkg['bump-patch-for-minor-pre-major']).toBe(false);
  });

  it('tags releases as vX.Y.Z, with no component prefix', () => {
    expect(config['include-component-in-tag']).toBe(false);
    expect(config['include-v-in-tag']).toBe(true);
  });
});
