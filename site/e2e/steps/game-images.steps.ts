import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import type { Catalogue, Item } from '../../src/catalogue/types';
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
    if (!item.name['en-US']) return [`${item.id}: no en-US name`];
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

// A one-kit catalogue served by a stand-in datamine whose single kit image is wrong or missing.
// The bytes are generated: not even a fixture may be a game image.
const kitImage = 'weapon/Wst_K_00.png';
const gearImages = { head: 'gear/Hed_G.png', clothes: 'gear/Clt_G.png', shoes: 'gear/Shs_G.png' };
const lockedKit = Buffer.from('a kit image');
const servedBody = (p: string) => Buffer.from(`image ${p}`);

async function badImage(serve: 'altered' | 'missing') {
  const server = createServer((req, res) => {
    const p = (req.url ?? '').replace(/^\/images\//, '');
    if (p !== kitImage) return res.end(servedBody(p));
    if (serve === 'missing') {
      res.writeHead(404);
      return res.end();
    }
    res.end(Buffer.from('not the locked bytes'));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}/`;
  const dir = mkdtempSync(join(tmpdir(), 'catalogue-'));
  const item = (id: string, image: string) => ({ id, name: { 'en-US': id }, image });
  const c: Catalogue = {
    version: '0.0.1',
    datamine: { repo: 'fixture', commit: 'x', dataFolder: '1' },
    kits: [item('K_00', kitImage)],
    gear: {
      head: [item('Hed_G', gearImages.head)],
      clothes: [item('Clt_G', gearImages.clothes)],
      shoes: [item('Shs_G', gearImages.shoes)],
    },
    excluded: { replicas: [], unobtainable: [] },
  };
  const lock = {
    [kitImage]: sha256(lockedKit),
    ...Object.fromEntries(Object.values(gearImages).map((p) => [p, sha256(servedBody(p))])),
  };
  mkdirSync(join(dir, c.version));
  writeFileSync(join(dir, c.version, 'catalogue.json'), JSON.stringify(c));
  writeFileSync(join(dir, c.version, 'images.lock.json'), JSON.stringify(lock));
  buildState.env = {
    CATALOGUE_DIR: dir,
    DATAMINE_BASE_URL: base,
    GAME_IMAGES_CACHE: mkdtempSync(join(tmpdir(), 'cache-')),
    BUILD_OUT_DIR: mkdtempSync(join(tmpdir(), 'build-')),
    PUBLIC_DIR: mkdtempSync(join(tmpdir(), 'public-')),
  };
  buildState.after = () => new Promise<void>((r) => server.close(() => r()));
  buildState.expected = {
    file: kitImage,
    digest: sha256(lockedKit),
    address: `${base}images/${kitImage}`,
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
