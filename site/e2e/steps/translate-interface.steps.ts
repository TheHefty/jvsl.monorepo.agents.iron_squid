import { cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tempDir } from '../support/temp';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { locales } from '../../src/i18n/locales';
import { encodeShare } from '../../src/share/link';
import type { Catalogue } from '../../src/catalogue/types';
import { messageIn } from '../support/messages';
import { playRun, seedRun, seedRunScript, winsThenPlaying } from '../support/seed';
import { Given, Then, When } from '../fixtures';
import { buildState } from '../support/build-state';

Given('a locale missing a text that en-US has', async () => {
  // The site's own catalogues, with one text removed from pt-BR, built elsewhere.
  const dir = tempDir('messages-');
  cpSync('src/i18n/messages', dir, { recursive: true });
  const file = join(dir, 'pt-BR.json');
  const pt = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  delete pt['run.won'];
  writeFileSync(file, JSON.stringify(pt));
  buildState.env = {
    MESSAGES_DIR: dir,
    BUILD_OUT_DIR: tempDir('build-'),
    PUBLIC_DIR: tempDir('public-'),
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

const catalogueOf = (locale: string) =>
  JSON.parse(readFileSync(`src/i18n/messages/${locale}.json`, 'utf8')) as Record<string, string>;
const english = catalogueOf('en-US');
const gameCatalogue = JSON.parse(
  readFileSync('src/catalogue/11.3.0/catalogue.json', 'utf8'),
) as Catalogue;

Given('a visitor on any of the {int} locale addresses', async ({ world }, count: number) => {
  expect(locales).toHaveLength(count);
  world.locales = [...locales];
});

// Every page a visitor can see in a locale, with a run in progress so the run's own texts show.
async function pageTexts(p: Page, locale: string): Promise<string> {
  const run = playRun([...winsThenPlaying(12), 'loss'], 'Ivo');
  const texts: string[] = [];
  for (const path of ['', 'terms/', 'privacy/', `run/#${encodeShare(run, gameCatalogue)}`]) {
    await p.goto(`./${locale}/${path}`);
    await expect(p.getByRole('contentinfo')).toBeVisible();
    expect(await p.locator('html').getAttribute('lang')).toBe(locale);
    if (path === '') {
      await expect(p.locator('.ink-strip')).toBeVisible();
      await p.locator('details.run-log summary').click();
    }
    texts.push(await p.locator('body').innerText());
  }
  return texts.join('\n');
}

Then("every text on every page is in that locale's language", async ({ page, world, $test }) => {
  // Four pages in each of thirteen languages: far more than one scenario's usual 30 seconds.
  $test.setTimeout(240_000);
  await seedRunScript(page, playRun([...winsThenPlaying(12), 'loss'], 'Ivo'));
  for (const locale of world.locales as string[]) {
    if (locale.startsWith('en-')) continue; // English pages are English
    const own = catalogueOf(locale);
    const text = await pageTexts(page, locale);
    expect(text, `${locale} shows its own footer`).toContain(messageIn(locale, 'footer.terms'));
    // No en-US sentence the locale words differently appears on its pages.
    for (const [key, value] of Object.entries(english)) {
      // Sentences only: a single word ("Headgear") can be part of a kit or gear name, which stays in
      // en-US until the names are localized.
      if (/[{}]/.test(value) || !value.includes(' ') || own[key] === value) continue;
      expect(text, `${locale} shows the en-US text of "${key}"`).not.toContain(value);
    }
  }
});

// Words a translation may keep as they are in en-US: the site's name and the catalogue's own data,
// and words a language uses as English writes them.
const sameInEveryLanguage = new Set(['site.name', 'translation.status']);
const sameIn: Record<string, string[]> = {
  // "Privacy" is the word Italian and Dutch use.
  'it-IT': ['footer.privacy', 'privacy.title'],
  'nl-NL': ['footer.privacy', 'privacy.title'],
};

Then(
  'so are the notices, the error messages and the screen-reader announcements',
  async ({ world }) => {
    for (const locale of world.locales as string[]) {
      if (locale.startsWith('en-')) continue;
      const own = catalogueOf(locale);
      const untranslated = Object.keys(english).filter(
        (key) =>
          !sameInEveryLanguage.has(key) &&
          !(sameIn[locale] ?? []).includes(key) &&
          own[key] === english[key],
      );
      expect(untranslated, `${locale} texts left in English`).toEqual([]);
    }
  },
);

Given('a visitor on the {string} address', async ({ world }, locale: string) => {
  world.locale = locale;
});

When('the player has {int} lives', async ({ page, world }, lives: number) => {
  // Ten wins earn a life: 10 × (lives − 1) wins from the one life a run starts with.
  const state = playRun(winsThenPlaying(10 * (lives - 1)));
  expect(state.lives).toBe(lives);
  await seedRun(page, state, world.locale as string);
});

Then(
  "the number of lives is written with that language's plural form for {int}",
  async ({ page, world }, lives: number) => {
    const locale = world.locale as string;
    // The strip draws lives as drops; the number is in their name, which screen readers read.
    const name = messageIn(locale, 'run.lives', { lives });
    await expect(page.locator('.ink-strip').getByLabel(name, { exact: true })).toBeVisible();
  },
);

Then('numbers and dates are written as German writes them', async ({ page }) => {
  const when = '2026-10-20T15:00:00.000Z';
  await seedRun(page, playRun(winsThenPlaying(1), undefined, when), 'de-DE');
  await page.locator('details.run-log summary').click();
  await expect(page.locator('.run-log time').first()).toHaveText('20. Oktober 2026');
  await expect(page.locator('.run-conquered')).toHaveText(
    messageIn('de-DE', 'run.conquered', { conquered: 1, total: 160 }),
  );
});

Given('a locale whose translation no fluent speaker has reviewed', async ({ world }) => {
  const locale = locales.find((l) => catalogueOf(l)['translation.status'] === 'unreviewed');
  if (!locale) throw new Error('steps: every translation has been reviewed');
  world.locale = locale;
});

When("a visitor is on that locale's address", async ({ page, world }) => {
  await page.goto(`./${world.locale as string}/`);
});

Then('the page says the translation has not been reviewed', async ({ page, world }) => {
  await expect(
    page.getByText(messageIn(world.locale as string, 'translation.unreviewed')),
  ).toBeVisible();
});

Then('the language switcher marks that language as unreviewed', async ({ page, world }) => {
  const locale = world.locale as string;
  const nav = page.getByRole('navigation', { name: messageIn(locale, 'language.label') });
  await nav.locator('summary').click();
  const autonyms = JSON.parse(readFileSync('src/i18n/autonyms.json', 'utf8')) as Record<
    string,
    string
  >;
  const entry = nav
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: autonyms[locale], exact: true }) });
  await expect(entry).toContainText(messageIn(locale, 'language.unreviewed'));
  // And a reviewed one is not marked.
  const reviewed = nav
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: autonyms['en-US'], exact: true }) });
  await expect(reviewed).not.toContainText(messageIn(locale, 'language.unreviewed'));
});
