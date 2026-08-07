import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  GAME_LOCALES,
  GAME_VERSION,
  GEAR_SOURCES,
  SOURCE_REPO,
  buildCatalogue,
  buildNames,
  type GearRow,
  type LanguageFile,
  type RawGameData,
  type WeaponRow
} from '../src/data/source.ts';
import type {GearSlot} from '../src/domain/types.ts';

/**
 * Regenerates the catalogue from Leanny/splat3.
 *
 * Run it deliberately — `npm run generate:catalogue` — not on every build. The
 * generated files are committed, so a deploy never depends on someone else's
 * repository being up and correct, and a roster change arrives as a reviewable
 * diff instead of appearing under a player mid-run.
 *
 * All the judgement lives in `src/data/source.ts`, which is unit-tested. This
 * file only fetches, writes, and reports.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'src', 'data');
const NAMES_DIR = join(OUT_DIR, 'names');

const BASE = `https://raw.githubusercontent.com/${SOURCE_REPO}/main/data`;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchRawGameData(): Promise<RawGameData> {
  const mush = `${BASE}/mush/${GAME_VERSION}`;

  const slots = Object.keys(GEAR_SOURCES) as GearSlot[];
  const [weapons, ...gearFiles] = await Promise.all([
    fetchJson<WeaponRow[]>(`${mush}/WeaponInfoMain.json`),
    ...slots.map((slot) =>
      fetchJson<GearRow[]>(`${mush}/${GEAR_SOURCES[slot].file}`)
    )
  ]);

  const gear = {} as Record<GearSlot, GearRow[]>;
  slots.forEach((slot, index) => {
    gear[slot] = gearFiles[index];
  });

  return {weapons, gear};
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  console.log(`Reading ${SOURCE_REPO} at game version ${GAME_VERSION}…`);

  const raw = await fetchRawGameData();
  const catalogue = buildCatalogue(raw);

  await mkdir(NAMES_DIR, {recursive: true});
  await writeJson(join(OUT_DIR, 'catalogue.json'), catalogue);

  for (const locale of GAME_LOCALES) {
    const language = await fetchJson<LanguageFile>(
      `${BASE}/language/${locale}.json`
    );
    // Throws on any name the catalogue needs and the language file lacks, so a
    // partial translation fails here rather than rendering as a blank tile.
    await writeJson(
      join(NAMES_DIR, `${locale}.json`),
      buildNames(catalogue, language)
    );
    console.log(`  ${locale}: names complete`);
  }

  const {gear} = catalogue;
  console.log(
    [
      '',
      `Weapons: ${catalogue.weapons.length}`,
      `Head:    ${gear.head.length}`,
      `Clothes: ${gear.clothes.length}`,
      `Shoes:   ${gear.shoes.length}`,
      `Gear:    ${gear.head.length + gear.clothes.length + gear.shoes.length}`
    ].join('\n')
  );
}

await main();
