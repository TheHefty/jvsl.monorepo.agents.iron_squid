import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Every page of the build under test, as addresses relative to the site's base: each HTML file is
// a page a visitor can reach, so a check meant for "every page" visits all of them.
export const siteDir = resolve(process.env.SITE_DIR ?? 'dist');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? htmlFiles(join(dir, e.name))
      : e.name.endsWith('.html')
        ? [join(dir, e.name)]
        : [],
  );
}

export const pagesOfBuild = () =>
  htmlFiles(siteDir).map((f) => relative(siteDir, f).replace(/(^|\/)index\.html$/, '$1'));
