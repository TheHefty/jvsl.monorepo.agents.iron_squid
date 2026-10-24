// Run by every build: refuses a catalogue a run cannot be played with (NFR-D6), and names what is
// wrong. A run uses one unused piece of each gear slot per kit, so no slot may be smaller than the
// number of kits.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gearSlots, type Catalogue } from '../../src/catalogue/types';

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
    if (!item.name['en-US']) problems.push(`${at}: ${item.id} has no en-US name`);
    if (!item.image) problems.push(`${at}: ${item.id} has no image`);
    if (seen.has(item.id)) problems.push(`${at}: the id ${item.id} is used more than once`);
    seen.add(item.id);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.env.CATALOGUE_DIR ?? 'src/catalogue';
  const versions = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (versions.length === 0) {
    console.error(`check-catalogue: no catalogue version under ${root}`);
    process.exit(1);
  }
  const problems = versions.flatMap((v) =>
    catalogueProblems(
      JSON.parse(readFileSync(`${root}/${v.name}/catalogue.json`, 'utf8')) as Catalogue,
    ),
  );
  for (const p of problems) console.error(`check-catalogue: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`check-catalogue: ${versions.map((v) => v.name).join(', ')} can be played`);
}
