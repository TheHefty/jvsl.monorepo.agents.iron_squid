import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tempDir } from './temp';

// Folders made by tempDir are removed when the test ends (debt is-m2n): in the agent container /tmp
// is memory, and folders left behind filled it until the kernel killed the browser.
let made = '';

describe('tempDir', () => {
  it('makes a folder under the system temp dir, with the prefix', () => {
    made = tempDir('probe-');
    expect(existsSync(made)).toBe(true);
    expect(made).toMatch(/probe-[^/]+$/);
  });

  it('removes it when the test that made it ends', () => {
    expect(made).not.toBe('');
    expect(existsSync(made)).toBe(false);
  });
});

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === 'node_modules' || e.name.startsWith('.')
        ? []
        : files(join(dir, e.name))
      : [join(dir, e.name)],
  );

describe('the tests', () => {
  it('make temporary folders only through tempDir, so every one is removed', () => {
    const offenders = ['e2e', 'scripts', 'src']
      .flatMap(files)
      .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('support/temp.ts'))
      .filter((f) => /\bmkdtempSync\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
