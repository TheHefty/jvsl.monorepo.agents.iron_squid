import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tempDir } from '../support/temp';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import type { Catalogue } from '../../src/catalogue/types';
import type { RunState } from '../../src/run/engine';
import { encodeShare } from '../../src/share/link';
import { Given, Then, When } from '../fixtures';
import { buildState } from '../support/build-state';
import { messageIn } from '../support/messages';
import { conquestMode, playRun, seedRun, winsThenPlaying } from '../support/seed';
import { pieceImages } from '../support/set';

const version = '11.3.0';
const catalogue = JSON.parse(
  readFileSync(`src/catalogue/${version}/catalogue.json`, 'utf8'),
) as Catalogue;
type NamesFile = { source: string; names: Record<string, string> };
const namesFile = (locale: string) =>
  JSON.parse(readFileSync(`src/catalogue/${version}/names/${locale}.json`, 'utf8')) as NamesFile;

// A complete run: every kit, and the gear drawn with each, on one shared page.
const complete = () => playRun([...winsThenPlaying(159), 'win']);

async function sharedSets(p: Page, locale: string, state: RunState) {
  await p.goto(`./${locale}/run/#${encodeShare(state, catalogue)}`);
  const items = p
    .getByRole('list', { name: messageIn(locale, 'shared.sets') })
    .getByRole('listitem');
  await expect(items).toHaveCount(state.conquered);
  return items.allInnerTexts();
}

// Text as a page shows it: some of the game's names end in a space, which HTML collapses.
const shown = (text: string) => text.replace(/\s+/g, ' ').trim();

// What the shared page writes for set n, in that locale, from that locale's names.
const sentence = (locale: string, state: RunState, n: number) => {
  const { names } = namesFile(locale);
  const name = (id: string | undefined) => names[id ?? ''] ?? `<no name for ${id}>`;
  return messageIn(locale, 'shared.set', {
    number: n + 1,
    kit: name(state.order.kits[n]),
    head: name(state.order.head[n]),
    clothes: name(state.order.clothes[n]),
    shoes: name(state.order.shoes[n]),
    recorded: String(conquestMode(state, n) !== undefined),
    mode: name(conquestMode(state, n)),
  });
};

Then(
  "every kit and gear piece is shown with its name from the game's {string} data",
  async ({ page, world, guard, $test }, gameData: string) => {
    $test.setTimeout(60_000);
    const locale = world.locale as string;
    // The names file says which game file it was generated from, whose digest the pin holds.
    expect(namesFile(locale).source).toBe(`data/language/${gameData}.json`);
    const state = complete();
    const texts = await sharedSets(page, locale, state);
    // Only this locale's texts and names were downloaded: every chunk named after a locale is its
    // own (failure 2). Message catalogues and names files are both chunks named by their locale.
    const otherLocales = guard.requests
      .map((url) => /\/assets\/([a-z]{2}-[A-Z]{2})-[^/]+\.js$/.exec(url.pathname)?.[1])
      .filter((l) => l !== undefined && l !== locale);
    expect(otherLocales, `chunks of other locales fetched on ${locale}`).toEqual([]);
    texts.forEach((text, n) =>
      expect(text, `set ${n + 1}`).toContain(shown(sentence(locale, state, n))),
    );
  },
);

Then('every kit and gear image is described by its French name', async ({ page, world }) => {
  const locale = world.locale as string;
  const state = playRun(winsThenPlaying(3));
  await seedRun(page, state, locale);
  const images = pieceImages(page, locale);
  await expect(images).toHaveCount(4);
  const { names } = namesFile(locale);
  const n = state.cursor;
  const expected = [
    state.order.kits[n],
    state.order.head[n],
    state.order.clothes[n],
    state.order.shoes[n],
  ].map((id) => names[id ?? '']);
  expect(await images.evaluateAll((imgs) => imgs.map((i) => (i as HTMLImageElement).alt))).toEqual(
    expected,
  );
});

Given('a link to a run made on the {string} address', async ({ world }, locale: string) => {
  // A link carries the run, not its words: the address it was made on changes nothing in it.
  expect(locale).toBe('en-US');
  world.state = playRun(winsThenPlaying(12));
});

When('a visitor opens it on the {string} address', async ({ page, world }, locale: string) => {
  world.locale = locale;
  world.texts = await sharedSets(page, locale, world.state as RunState);
});

Then("the run's kits and gear are shown with their Japanese names", async ({ world }) => {
  const state = world.state as RunState;
  (world.texts as string[]).forEach((text, n) =>
    expect(text).toContain(shown(sentence('ja-JP', state, n))),
  );
});

Given('game data in which a kit has no name in one locale', async () => {
  // The site's catalogue as generated, with one kit's Korean name removed, built elsewhere.
  const dir = tempDir('catalogue-');
  cpSync('src/catalogue', dir, { recursive: true });
  const file = join(dir, version, 'names', 'ko-KR.json');
  const ko = JSON.parse(readFileSync(file, 'utf8')) as NamesFile;
  const kit = catalogue.kits[0]?.id ?? '';
  writeFileSync(
    file,
    JSON.stringify({
      ...ko,
      names: Object.fromEntries(Object.entries(ko.names).filter(([id]) => id !== kit)),
    }),
  );
  buildState.env = {
    CATALOGUE_DIR: dir,
    BUILD_OUT_DIR: tempDir('build-'),
    PUBLIC_DIR: tempDir('public-'),
  };
  buildState.expected = { file: kit, digest: '', address: '' };
});

Then('the failure names the kit and the locale', async () => {
  const kit = buildState.expected?.file ?? '';
  expect(buildState.result?.output).toContain(
    `check-catalogue: catalogue ${version}: ${kit} has no ko-KR name`,
  );
});
