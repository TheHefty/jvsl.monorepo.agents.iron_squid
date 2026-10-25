import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { Given, Then, When } from '../fixtures';
import { buildState } from '../support/build-state';

Given('a locale missing a text that en-US has', async () => {
  // The site's own catalogues, with one text removed from pt-BR, built elsewhere.
  const dir = mkdtempSync(join(tmpdir(), 'messages-'));
  cpSync('src/i18n/messages', dir, { recursive: true });
  const file = join(dir, 'pt-BR.json');
  const pt = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  delete pt['run.won'];
  writeFileSync(file, JSON.stringify(pt));
  buildState.env = {
    MESSAGES_DIR: dir,
    BUILD_OUT_DIR: mkdtempSync(join(tmpdir(), 'build-')),
    PUBLIC_DIR: mkdtempSync(join(tmpdir(), 'public-')),
  };
});

Then('the failure names the locale and the missing text', async () => {
  expect(buildState.result?.output).toContain(
    'check-messages: pt-BR lacks "run.won", which en-US has',
  );
});

When('someone reads the README', async ({ world }) => {
  world.readme = readFileSync('../README.md', 'utf8');
});

Then('it lists every locale whose translation has not been reviewed', async ({ world }) => {
  const unreviewed = readdirSync('src/i18n/messages')
    .map((f) => f.replace(/\.json$/, ''))
    .filter((locale) => {
      const m = JSON.parse(readFileSync(`src/i18n/messages/${locale}.json`, 'utf8')) as Record<
        string,
        string
      >;
      return m['translation.status'] === 'unreviewed';
    })
    .sort();
  const section = /## Translations\n([\s\S]*?)(\n## |$)/.exec(world.readme as string)?.[1] ?? '';
  const listed = [...section.matchAll(/^- `([a-z]{2}-[A-Z]{2})`.*unreviewed/gm)]
    .map((m) => m[1])
    .sort();
  expect(listed).toEqual(unreviewed);
});
