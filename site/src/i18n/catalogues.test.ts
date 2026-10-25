import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from './locales';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );

describe('the message catalogues', () => {
  it('exist for every locale the site offers, and only for those', () => {
    const present = readdirSync('src/i18n/messages').map((f) => f.replace(/\.json$/, ''));
    expect(present.sort()).toEqual([...locales].sort());
  });

  it('are never imported whole into the code, so a page downloads only its own (failure 3)', () => {
    const code = files('src').filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
    const importing = code.filter((f) =>
      /from ['"][^'"]*messages\/[^'"]+\.json['"]/.test(readFileSync(f, 'utf8')),
    );
    expect(importing).toEqual([]);
  });

  it('are loaded one by one, on demand, by the locale of the page', () => {
    const loader = readFileSync('src/i18n/load.ts', 'utf8');
    expect(loader).toMatch(/import\.meta\.glob[^(]*\(\s*['"]\.\/messages\/\*\.json['"]/);
    expect(loader).not.toMatch(/eager:\s*true/);
  });
});
