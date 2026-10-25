// Run by every build before vite: fetches each image named in a catalogue's images.lock.json from
// the datamine that catalogue was generated from, checks it against its SHA-256, and places it in
// public/game/<version>/ for vite to publish. Game images are never committed (NFR-D3).
//
// Verified images are cached by digest in .cache/game-images, so a build downloads only what the
// cache lacks; a cached file is verified again before use and fetched again if it no longer
// matches. A download goes to a temporary file and enters the cache only once verified.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalogue } from '../../src/catalogue/types';
import { fetchBytes, mapLimit, sha256 } from './fetch';

type Options = {
  catalogueRoot: string;
  cacheDir: string;
  outDir: string;
  baseFor: (catalogue: { version: string; datamine?: Catalogue['datamine'] }) => string;
  retryDelayMs?: number;
};

export async function fetchImages({
  catalogueRoot,
  cacheDir,
  outDir,
  baseFor,
  retryDelayMs,
}: Options) {
  mkdirSync(cacheDir, { recursive: true });
  let images = 0;
  let downloaded = 0;
  for (const version of readdirSync(catalogueRoot, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  )) {
    const dir = join(catalogueRoot, version.name);
    const lock = JSON.parse(readFileSync(join(dir, 'images.lock.json'), 'utf8')) as Record<
      string,
      string
    >;
    const catalogueFile = join(dir, 'catalogue.json');
    const datamine = existsSync(catalogueFile)
      ? (JSON.parse(readFileSync(catalogueFile, 'utf8')) as Catalogue).datamine
      : undefined;
    const base = baseFor({ version: version.name, datamine });

    await mapLimit(Object.entries(lock), 8, async ([path, digest]) => {
      const cached = join(cacheDir, digest);
      if (!(existsSync(cached) && sha256(readFileSync(cached)) === digest)) {
        rmSync(cached, { force: true });
        const bytes = await fetchBytes(base, `images/${path}`, { retryDelayMs });
        const received = sha256(bytes);
        if (received !== digest) {
          throw new Error(
            `game-images: ${path} does not match its digest: expected ${digest}, received ${received}`,
          );
        }
        const partial = `${cached}.${process.pid}.partial`;
        writeFileSync(partial, bytes);
        renameSync(partial, cached);
        downloaded += 1;
      }
      const target = join(outDir, version.name, path);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(cached, target);
      images += 1;
    });
  }
  return { images, downloaded };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const override = process.env.DATAMINE_BASE_URL;
  const result = await fetchImages({
    catalogueRoot: process.env.CATALOGUE_DIR ?? 'src/catalogue',
    cacheDir: process.env.GAME_IMAGES_CACHE ?? '.cache/game-images',
    outDir: join(process.env.PUBLIC_DIR ?? 'public', 'game'),
    baseFor: ({ version, datamine }) => {
      if (override) return override;
      if (!datamine) throw new Error(`game-images: catalogue ${version} names no datamine`);
      return `https://raw.githubusercontent.com/${datamine.repo}/${datamine.commit}/`;
    },
  });
  console.log(
    `game-images: ${result.images} image(s) verified, ${result.downloaded} downloaded, ` +
      `${result.images - result.downloaded} from the cache`,
  );
}
