import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import type { Catalogue, NamesFile } from '../../src/catalogue/types';
import { Given, Then, When } from '../fixtures';
import { startDatamine } from '../support/datamine-fixture';
import { buildState } from '../support/build-state';
import { run } from '../support/run';

let catalogue: Catalogue;
// The names a player of the en-US site sees, as the catalogue was generated.
let english: Record<string, string> = {};
const gearOf = (c: Catalogue) => Object.values(c.gear).flat();

Given('the site is built from the game data for version {word}', async ({}, version: string) => {
  catalogue = JSON.parse(
    readFileSync(`src/catalogue/${version}/catalogue.json`, 'utf8'),
  ) as Catalogue;
  expect(catalogue.version).toBe(version);
  english = (
    JSON.parse(readFileSync(`src/catalogue/${version}/names/en-US.json`, 'utf8')) as NamesFile
  ).names;
});

Then('the catalogue has {int} kits', async ({}, n: number) => {
  expect(catalogue.kits).toHaveLength(n);
});

Then(/^the catalogue does not contain the (.+)$/, async ({}, name: string) => {
  expect(catalogue.kits.map((k) => english[k.id])).not.toContain(name);
});

Then(
  'the catalogue contains no gear the game marks as unobtainable for online battles',
  async () => {
    const ids = new Set(gearOf(catalogue).map((g) => g.id));
    expect(catalogue.excluded.unobtainable.length).toBeGreaterThan(0);
    expect(catalogue.excluded.unobtainable.filter((id) => ids.has(id))).toEqual([]);
  },
);

Then('it contains no gear that exists only inside Hero Mode or Side Order', async () => {
  const modeOnly = catalogue.excluded.unobtainable.filter((id) => /_(MSN|SDODR)/.test(id));
  const ids = new Set(gearOf(catalogue).map((g) => g.id));
  expect(modeOnly.length).toBeGreaterThan(0);
  expect(modeOnly.filter((id) => ids.has(id))).toEqual([]);
});

Then(
  'the catalogue contains the Hero Mode and Side Order rewards a player can wear online',
  async () => {
    const rewards = gearOf(catalogue).filter((g) => /_(MSN|SDODR)/.test(g.id));
    expect(rewards.map((g) => english[g.id])).toEqual(
      expect.arrayContaining(['Hero Headset Replica', 'Order Suit Replica']),
    );
  },
);

// A build of the site from a catalogue the scenario sets up, into a directory of its own.

Given('game data in which one gear slot has fewer pieces than there are kits', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'catalogue-'));
  const short = structuredClone(catalogue);
  short.version = '0.0.1';
  short.gear.shoes = short.gear.shoes.slice(0, short.kits.length - 1);
  mkdirSync(join(dir, short.version));
  writeFileSync(join(dir, short.version, 'catalogue.json'), JSON.stringify(short));
  buildState.env = {
    CATALOGUE_DIR: dir,
    BUILD_OUT_DIR: mkdtempSync(join(tmpdir(), 'build-')),
    PUBLIC_DIR: mkdtempSync(join(tmpdir(), 'public-')),
  };
});

When('the site is built', async () => {
  // Into a directory of its own, never over the dist/ under test.
  buildState.result = await run('npm', ['run', 'build'], buildState.env);
  await buildState.after?.();
  buildState.after = undefined;
});

Then('the build fails', async () => {
  expect(buildState.result?.status, buildState.result?.output).not.toBe(0);
});

Then('the failure names the slot, how many pieces it has and how many kits there are', async () => {
  const kits = catalogue.kits.length;
  expect(buildState.result?.output).toContain(
    `the shoes slot has ${kits - 1} pieces and there are ${kits} kits`,
  );
});

// Two commits of a stand-in datamine: the newer adds a kit and a gear piece and drops one of each.
let regenerated = '';

Given('the pin on the game data is moved to a newer commit', async () => {
  const datamine = await startDatamine({
    old: { kits: ['A_Kit_00', 'B_Kit_00'], gear: ['G1', 'G2', 'G3'] },
    new: { kits: ['A_Kit_00', 'C_Kit_00'], gear: ['G1', 'G2', 'G4'] },
  });
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  const pin = (commit: string, gameVersion: string) => {
    const file = join(dir, `${commit}.pin.json`);
    writeFileSync(
      file,
      JSON.stringify({ repo: 'fixture', commit, dataFolder: '1', gameVersion, sources: {} }),
    );
    return file;
  };
  const env = (commit: string, version: string) => ({
    CATALOGUE_PIN: pin(commit, version),
    CATALOGUE_DIR: join(dir, 'catalogue'),
    DATAMINE_BASE_URL: datamine.urlFor(commit),
  });
  const first = await run(
    'npx',
    ['tsx', 'scripts/catalogue/generate.ts', '--record-digests'],
    env('old', '1.0.0'),
  );
  expect(first.status, first.output).toBe(0);
  regenerate = () =>
    run(
      'npx',
      ['tsx', 'scripts/catalogue/generate.ts', '--record-digests', '--allow-removed'],
      env('new', '2.0.0'),
    );
  afterRegenerate = datamine.close;
});

let regenerate: () => Promise<{ status: number; output: string }>;
let afterRegenerate: () => Promise<void>;

When('the catalogue is regenerated', async () => {
  const r = await regenerate();
  await afterRegenerate();
  expect(r.status, r.output).toBe(0);
  regenerated = r.output;
});

Then(
  'the change to the catalogue shows which kits and gear were added and which were removed',
  async () => {
    expect(regenerated).toContain('generate: 1.0.0 -> 2.0.0');
    expect(regenerated).toContain('kits: +1 (C_Kit_00), -1 (B_Kit_00)');
    expect(regenerated).toContain('head: +1 (Hed_G4), -1 (Hed_G3)');
  },
);
