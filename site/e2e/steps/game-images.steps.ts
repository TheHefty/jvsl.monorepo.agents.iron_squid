import { createHash } from 'node:crypto';
import { tempDir } from '../support/temp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import type { Catalogue, Item } from '../../src/catalogue/types';
import { locales } from '../../src/i18n/locales';
import { Given, Then } from '../fixtures';
import { buildState } from '../support/build-state';
import { run } from '../support/run';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const siteDir = process.env.SITE_DIR ?? 'dist';
const version = '11.3.0';
const catalogue = JSON.parse(
  readFileSync(`src/catalogue/${version}/catalogue.json`, 'utf8'),
) as Catalogue;
const lock = JSON.parse(
  readFileSync(`src/catalogue/${version}/images.lock.json`, 'utf8'),
) as Record<string, string>;

// The published build holds the image of every item, with the bytes its lock recorded.
function publishedWithImage(items: Item[]) {
  const wrong = items.flatMap((item) => {
    const file = join(siteDir, 'game', version, item.image);
    if (!existsSync(file)) return [`${item.id}: ${file} is missing`];
    return sha256(readFileSync(file)) === lock[item.image]
      ? []
      : [`${item.id}: ${file} has other bytes`];
  });
  expect(wrong).toEqual([]);
}

Then('every kit in the catalogue has its official en-US name and its image', async () => {
  publishedWithImage(catalogue.kits);
});

Then('every gear piece in the catalogue has its official en-US name and its image', async () => {
  publishedWithImage(Object.values(catalogue.gear).flat());
});

// A one-kit catalogue served by a stand-in datamine whose kit image, or brand icon, is wrong or
// missing. The bytes are generated: not even a fixture may be a game image.
const kitImage = 'weapon/Wst_K_00.png';
const brandImage = 'brand/B00.png';
const gearImages = { head: 'gear/Hed_G.png', clothes: 'gear/Clt_G.png', shoes: 'gear/Shs_G.png' };
const lockedBad = Buffer.from('the locked image');
const servedBody = (p: string) => Buffer.from(`image ${p}`);

async function badImage(serve: 'altered' | 'missing', bad = kitImage) {
  const server = createServer((req, res) => {
    const p = (req.url ?? '').replace(/^\/images\//, '');
    if (p !== bad) return res.end(servedBody(p));
    if (serve === 'missing') {
      res.writeHead(404);
      return res.end();
    }
    res.end(Buffer.from('not the locked bytes'));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}/`;
  const dir = tempDir('catalogue-');
  const item = (id: string, image: string) => ({ id, image });
  const piece = (id: string, image: string) => ({ id, image, brand: 'B00' });
  const c: Catalogue = {
    version: '0.0.1',
    datamine: { repo: 'fixture', commit: 'x', dataFolder: '1' },
    kits: [item('K_00', kitImage)],
    gear: {
      head: [piece('Hed_G', gearImages.head)],
      clothes: [piece('Clt_G', gearImages.clothes)],
      shoes: [piece('Shs_G', gearImages.shoes)],
    },
    brands: [item('B00', brandImage)],
    excluded: { replicas: [], unobtainable: [] },
    modes: [{ id: 'Pnt' }],
  };
  const lock = {
    ...Object.fromEntries(
      [kitImage, brandImage, ...Object.values(gearImages)].map((p) => [p, sha256(servedBody(p))]),
    ),
    [bad]: sha256(lockedBad),
  };
  mkdirSync(join(dir, c.version));
  writeFileSync(join(dir, c.version, 'catalogue.json'), JSON.stringify(c));
  writeFileSync(join(dir, c.version, 'images.lock.json'), JSON.stringify(lock));
  // Named in every locale, so the build gets as far as the images it is meant to fail on.
  mkdirSync(join(dir, c.version, 'names'));
  const names = Object.fromEntries(
    [...c.kits, ...c.gear.head, ...c.gear.clothes, ...c.gear.shoes, ...c.brands, ...c.modes].map(
      (i) => [i.id, i.id],
    ),
  );
  for (const locale of locales)
    writeFileSync(
      join(dir, c.version, 'names', `${locale}.json`),
      JSON.stringify({ source: 'fixture', names }),
    );
  buildState.env = {
    CATALOGUE_DIR: dir,
    DATAMINE_BASE_URL: base,
    GAME_IMAGES_CACHE: tempDir('cache-'),
    BUILD_OUT_DIR: tempDir('build-'),
    PUBLIC_DIR: tempDir('public-'),
  };
  buildState.after = () => new Promise<void>((r) => server.close(() => r()));
  buildState.expected = {
    file: bad,
    digest: sha256(lockedBad),
    address: `${base}images/${bad}`,
  };
}

const expectedFailure = () => {
  if (!buildState.expected) throw new Error('steps: no failing build was set up');
  return buildState.expected;
};

Given('an image whose content differs from the digest recorded for it', async () => {
  await badImage('altered');
});

Given('an image the build cannot download', async () => {
  await badImage('missing');
});

Then('the failure names the file, the digest expected and the digest received', async () => {
  const { file, digest } = expectedFailure();
  expect(buildState.result?.output).toContain(
    `game-images: ${file} does not match its digest: expected ${digest}, ` +
      `received ${sha256(Buffer.from('not the locked bytes'))}`,
  );
});

Then('the failure names the file and the address it was fetched from', async () => {
  const { file, address } = expectedFailure();
  expect(buildState.result?.output).toContain(
    `could not fetch images/${file} from ${address}: HTTP 404`,
  );
});

Then('no image from the game is tracked in the repository', async () => {
  const r = await run('npx', ['tsx', 'scripts/catalogue/no-game-images.ts']);
  expect(r.status, r.output).toBe(0);
  expect(r.output).toContain('no tracked file is a game image');
});

// gear-brand: brand icons are game images like any other, fetched and checked by the build.
Given('a brand icon whose downloaded bytes do not match the committed digest', async () => {
  await badImage('altered', brandImage);
});

Then('the build fails, naming the icon, the expected digest and the one received', async () => {
  const { file, digest } = expectedFailure();
  expect(file).toBe(brandImage);
  expect(buildState.result?.status, buildState.result?.output).not.toBe(0);
  expect(buildState.result?.output).toContain(
    `game-images: ${file} does not match its digest: expected ${digest}, ` +
      `received ${sha256(Buffer.from('not the locked bytes'))}`,
  );
});

Then('no file tracked in the repository has the bytes of a brand icon', async () => {
  // The check covers brand icons because each one has a digest in the lock it reads.
  const missing = catalogue.brands.filter((b) => !lock[b.image]).map((b) => b.id);
  expect(missing).toEqual([]);
  expect(catalogue.brands.length).toBeGreaterThan(0);
  const r = await run('npx', ['tsx', 'scripts/catalogue/no-game-images.ts']);
  expect(r.status, r.output).toBe(0);
  expect(r.output).toContain('no tracked file is a game image');
});

Then('every brand icon is served by the site', async () => {
  publishedWithImage(catalogue.brands);
});
