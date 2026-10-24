// Generates site/src/catalogue/<version>/ from the datamine pinned in catalogue.pin.json. Run by a
// person when the pin moves, never by CI: the output is committed, so a game update reaches the
// site as a reviewable diff (NFR-D4). Images are downloaded only to record their digests; none is
// kept (docs/RULES.md).
//
//   npx tsx scripts/catalogue/generate.ts [--record-digests] [--allow-removed]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gearSlots, type Catalogue } from '../../src/catalogue/types';
import { catalogueProblems } from './check';
import { describeDiff, diffCatalogues, removedIds } from './diff';
import { fetchBytes, mapLimit, sha256 } from './fetch';
import { buildCatalogue, type Source } from './rules';

type Pin = {
  repo: string;
  commit: string;
  dataFolder: string;
  gameVersion: string;
  sources: Record<string, string>;
};

const pinFile = process.env.CATALOGUE_PIN ?? 'catalogue.pin.json';
const outRoot = process.env.CATALOGUE_DIR ?? 'src/catalogue';
const record = process.argv.includes('--record-digests');
const allowRemoved = process.argv.includes('--allow-removed');

const pin = JSON.parse(readFileSync(pinFile, 'utf8')) as Pin;
const base =
  process.env.DATAMINE_BASE_URL ?? `https://raw.githubusercontent.com/${pin.repo}/${pin.commit}/`;
const files = {
  weapons: `data/mush/${pin.dataFolder}/WeaponInfoMain.json`,
  head: `data/mush/${pin.dataFolder}/GearInfoHead.json`,
  clothes: `data/mush/${pin.dataFolder}/GearInfoClothes.json`,
  shoes: `data/mush/${pin.dataFolder}/GearInfoShoes.json`,
  names: 'data/language/USen.json',
};

async function source(path: string): Promise<unknown> {
  const bytes = await fetchBytes(base, path);
  const received = sha256(bytes);
  const expected = pin.sources[path];
  if (expected === undefined && !record) {
    throw new Error(`generate: ${path} has no pinned digest; run with --record-digests to pin it`);
  }
  if (expected !== undefined && expected !== received) {
    throw new Error(
      `datamine: ${path} does not match its pinned digest: expected ${expected}, received ${received}`,
    );
  }
  pin.sources[path] = received;
  return JSON.parse(bytes.toString('utf8'));
}

const [weapons, head, clothes, shoes, names] = await Promise.all(Object.values(files).map(source));
const catalogue = buildCatalogue({
  gameVersion: pin.gameVersion,
  datamine: { repo: pin.repo, commit: pin.commit, dataFolder: pin.dataFolder },
  weapons,
  gear: { head, clothes, shoes },
  names,
} as Source);

const problems = catalogueProblems(catalogue);
if (problems.length) throw new Error(problems.join('\n'));

// The newest other version already generated, if any, is what this one is compared with.
const semver = (v: string) => v.split('.').map(Number);
const earlier = existsSync(outRoot)
  ? readdirSync(outRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== catalogue.version)
      .map((e) => e.name)
      .sort((a, b) => {
        const [x, y] = [semver(a), semver(b)];
        return x.reduce((d, n, i) => d || n - (y[i] ?? 0), 0);
      })
      .pop()
  : undefined;
if (earlier) {
  const before = JSON.parse(
    readFileSync(join(outRoot, earlier, 'catalogue.json'), 'utf8'),
  ) as Catalogue;
  const diff = diffCatalogues(before, catalogue);
  console.log(`generate: ${earlier} -> ${catalogue.version}\n${describeDiff(diff)}`);
  const removed = removedIds(diff);
  if (removed.length && !allowRemoved) {
    throw new Error(
      `generate: ${catalogue.version} drops ${removed.length} id(s) that ${earlier} has (${removed.join(', ')}); ` +
        'a run in progress may hold them. Pass --allow-removed once that is understood.',
    );
  }
}

const items = [...catalogue.kits, ...gearSlots.flatMap((s) => catalogue.gear[s])];
let done = 0;
const digests = await mapLimit(items, 8, async (item) => {
  const digest = sha256(await fetchBytes(base, `images/${item.image}`));
  if (++done % 100 === 0) console.log(`generate: ${done}/${items.length} images hashed`);
  return [item.image, digest] as const;
});

const out = join(outRoot, catalogue.version);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'catalogue.json'), JSON.stringify(catalogue, null, 2) + '\n');
writeFileSync(
  join(out, 'images.lock.json'),
  JSON.stringify(Object.fromEntries([...digests].sort(([a], [b]) => a.localeCompare(b))), null, 2) +
    '\n',
);
if (record) writeFileSync(pinFile, JSON.stringify(pin, null, 2) + '\n');
console.log(
  `generate: ${catalogue.version}: ${catalogue.kits.length} kits, ` +
    gearSlots.map((s) => `${catalogue.gear[s].length} ${s}`).join(', ') +
    `, ${catalogue.excluded.replicas.length} replicas and ${catalogue.excluded.unobtainable.length} unobtainable left out; ` +
    `${digests.length} image digests`,
);
