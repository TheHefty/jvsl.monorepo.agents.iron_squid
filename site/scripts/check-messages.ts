// Run by every build (NFR-I7): refuses a locale's catalogue that lacks a text the default locale
// has, has one it does not, does not parse as ICU, uses other arguments than the default's message,
// or lacks a plural form its language uses for whole numbers. Names the locale and the key.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

type Catalogue = Record<string, string>;

// Every argument a message uses, and the plural forms each plural argument offers.
function shape(
  elements: MessageFormatElement[],
  args = new Set<string>(),
  plurals = new Map<string, Set<string>>(),
) {
  for (const e of elements) {
    if (
      e.type === TYPE.argument ||
      e.type === TYPE.number ||
      e.type === TYPE.date ||
      e.type === TYPE.time
    )
      args.add(e.value);
    if (e.type === TYPE.select || e.type === TYPE.plural) {
      args.add(e.value);
      if (e.type === TYPE.plural && e.pluralType === 'cardinal') {
        const forms = plurals.get(e.value) ?? new Set<string>();
        for (const key of Object.keys(e.options)) forms.add(key);
        plurals.set(e.value, forms);
      }
      for (const option of Object.values(e.options)) shape(option.value, args, plurals);
    }
    if (e.type === TYPE.tag) shape(e.children, args, plurals);
  }
  return { args, plurals };
}

// The plural forms a language uses for whole numbers. Forms only compact numbers take (Portuguese
// and French "many", for "1 mi") are not asked for: every count here is a whole number.
function wholeNumberForms(locale: string): string[] {
  const rules = new Intl.PluralRules(locale);
  const forms = new Set<string>();
  for (let n = 0; n <= 1000; n++) forms.add(rules.select(n));
  return rules.resolvedOptions().pluralCategories.filter((f) => forms.has(f));
}

const list = (s: Set<string>) => `{${[...s].sort().join(', ')}}`;

export function messageProblems(catalogues: Record<string, Catalogue>, source: string): string[] {
  const base = catalogues[source];
  if (!base) return [`no catalogue for the default locale ${source}`];
  const problems: string[] = [];
  for (const [locale, catalogue] of Object.entries(catalogues)) {
    for (const key of Object.keys(base))
      if (!(key in catalogue)) problems.push(`${locale} lacks "${key}", which ${source} has`);
    for (const key of Object.keys(catalogue))
      if (!(key in base)) problems.push(`${locale} has "${key}", which ${source} does not`);
    const status = catalogue['translation.status'];
    if (status !== undefined && status !== 'reviewed' && status !== 'unreviewed')
      problems.push(
        `${locale} "translation.status" is "${status}"; it must be "reviewed" or "unreviewed"`,
      );
    const needed = wholeNumberForms(locale);
    for (const [key, text] of Object.entries(catalogue)) {
      const original = base[key];
      if (original === undefined || key === 'translation.status') continue;
      let mine: ReturnType<typeof shape>;
      try {
        mine = shape(parse(text));
      } catch (e) {
        problems.push(`${locale} "${key}" is not a valid message: ${(e as Error).message}`);
        continue;
      }
      const theirs = shape(parse(original));
      if (list(mine.args) !== list(theirs.args))
        problems.push(
          `${locale} "${key}" uses ${list(mine.args)}; ${source} uses ${list(theirs.args)}`,
        );
      for (const [arg, forms] of mine.plurals) {
        const missing = needed.filter((f) => !forms.has(f));
        if (missing.length)
          problems.push(
            `${locale} "${key}" has no plural form ${missing.map((f) => `"${f}"`).join(', ')} for {${arg}}`,
          );
      }
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.env.MESSAGES_DIR ?? 'src/i18n/messages';
  const catalogues = Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(dir, f), 'utf8'))]),
  ) as Record<string, Catalogue>;
  const problems = messageProblems(catalogues, 'en-US');
  for (const p of problems) console.error(`check-messages: ${p}`);
  if (problems.length) process.exit(1);
  console.log(`check-messages: ${Object.keys(catalogues).sort().join(', ')} are complete`);
}
