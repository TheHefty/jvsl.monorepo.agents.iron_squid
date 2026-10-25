import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = new URL('../src/', import.meta.url).pathname;
const stylesheets = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? stylesheets(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : [],
  );

describe('stylesheets', () => {
  it('take every colour from the tokens', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch)\(/;
    const found = stylesheets(src)
      .filter((f) => !f.endsWith('/styles/tokens.css'))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .flatMap((line, i) =>
            literal.test(line) ? [`${f.replace(src, 'src/')}:${i + 1}: ${line.trim()}`] : [],
          ),
      );
    expect(found).toEqual([]);
  });

  it('load nothing from another host', () => {
    const found = stylesheets(src).flatMap((f) =>
      /@import\s+url\(|url\(\s*['"]?https?:/.test(readFileSync(f, 'utf8')) ? [f] : [],
    );
    expect(found).toEqual([]);
  });
});

describe('the Inter font', () => {
  const dir = new URL('../src/fonts/', import.meta.url).pathname;

  it('is the file of the rsms/inter v4.1 release that was reviewed', () => {
    const bytes = readFileSync(join(dir, 'InterVariable.woff2'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      '693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3',
    );
  });

  it('travels with its licence', () => {
    expect(existsSync(join(dir, 'OFL.txt'))).toBe(true);
    expect(readFileSync(join(dir, 'OFL.txt'), 'utf8')).toContain(
      'SIL Open Font License, Version 1.1',
    );
  });
});
