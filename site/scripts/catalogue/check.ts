// Run by every build: refuses a catalogue a run cannot be played with (NFR-D6), or one an item has
// no name in for a locale the site offers (NFR-I3), and names what is wrong. A run uses one unused
// piece of each gear slot per kit, so no slot may be smaller than the number of kits.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gearSlots, type Catalogue, type NamesFile } from '../../src/catalogue/types';
import { locales } from '../../src/i18n/locales';

export function catalogueProblems(c: Catalogue): string[] {
  const at = `catalogue ${c.version}`;
  if (c.kits.length === 0) return [`${at}: no kits`];
  const problems: string[] = [];
  for (const slot of gearSlots) {
    const n = c.gear[slot].length;
    if (n < c.kits.length) {
      problems.push(
        `${at}: the ${slot} slot has ${n} pieces and there are ${c.kits.length} kits; ` +
          'a run needs one unused piece per kit',
      );
    }
  }
  const all = [...c.kits, ...gearSlots.flatMap((s) => c.gear[s])];
  const seen = new Set<string>();
  for (const item of all) {
    if (!item.image) problems.push(`${at}: ${item.id} has no image`);
    if (seen.has(item.id)) problems.push(`${at}: the id ${item.id} is used more than once`);
    seen.add(item.id);
  }
  return problems;
}

// Every item named, in every locale the site offers.
export function nameProblems(
  c: Catalogue,
  names: Record<string, Record<string, string>>,
  wanted: readonly string[],
): string[] {
  const items = [...c.kits, ...gearSlots.flatMap((s) => c.gear[s])];
  return wanted.flatMap((locale) => {
    const own = names[locale];
    if (!own) return [`catalogue ${c.version} has no names for ${locale}`];
    return items
      .filter((item) => !own[item.id])
      .map((item) => `catalogue ${c.version}: ${item.id} has no ${locale} name`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.env.CATALOGUE_DIR ?? 'src/catalogue';
  const versions = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (versions.length === 0) {
    console.error(`check-catalogue: no catalogue version under ${root}`);
    process.exit(1);
  }
  const problems = versions.flatMap((v) => {
    const c = JSON.parse(readFileSync(join(root, v.name, 'catalogue.json'), 'utf8')) as Catalogue;
    const names = Object.fromEntries(
      locales
        .map((l) => [l, join(root, v.name, 'names', `${l}.json`)] as const)
        .filter(([, file]) => existsSync(file))
        .map(([l, file]) => [l, (JSON.parse(readFileSync(file, 'utf8')) as NamesFile).names]),
    );
    return [...catalogueProblems(c), ...nameProblems(c, names, locales)];
  });
  for (const p of problems) console.error(`check-catalogue: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`check-catalogue: ${versions.map((v) => v.name).join(', ')} can be played`);
}
