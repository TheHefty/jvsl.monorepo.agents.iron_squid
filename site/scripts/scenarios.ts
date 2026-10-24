// Reads the registered .feature files the way the runner does, so the acceptance job can tell a
// run that executed every scenario from one that silently executed none (task project-scaffold,
// failure 1).
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import { IdGenerator, type Tag } from '@cucumber/messages';

function parse(source: string) {
  const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher());
  return parser.parse(source);
}

const has = (tags: readonly Tag[], names: readonly string[]) =>
  tags.some((t) => names.includes(t.name.replace(/^@/, '')));

function scenarios(source: string) {
  const feature = parse(source).feature;
  if (!feature) return [];
  return feature.children.flatMap((c) =>
    c.scenario ? [{ ...c.scenario, featureTags: feature.tags }] : [],
  );
}

export function countScenarios(
  source: string,
  excludedTags: readonly string[],
  pendingNames: readonly string[] = [],
): number {
  return scenarios(source)
    .filter(
      (s) => !has([...s.featureTags, ...s.tags], excludedTags) && !pendingNames.includes(s.name),
    )
    .reduce((n, s) => {
      if (s.examples.length === 0) return n + 1;
      const rows = s.examples
        .filter((e) => !has(e.tags, excludedTags))
        .reduce((m, e) => m + e.tableBody.length, 0);
      return n + rows;
    }, 0);
}

export function countScenariosTagged(source: string, tag: string): number {
  const tagged = (s: ReturnType<typeof scenarios>[number]) =>
    has([...s.featureTags, ...s.tags], [tag]);
  return scenarios(source)
    .filter(tagged)
    .reduce(
      (n, s) =>
        n + (s.examples.length === 0 ? 1 : s.examples.reduce((m, e) => m + e.tableBody.length, 0)),
      0,
    );
}

export function scenariosTagged(source: string, tag: string): string[] {
  return scenarios(source)
    .filter((s) => has([...s.featureTags, ...s.tags], [tag]))
    .map((s) => s.name);
}

export function missingFromRun({ expected, executed }: { expected: number; executed: number }) {
  if (executed >= expected) return undefined;
  return `${expected} scenario(s) expected from the registered features, ${executed} executed`;
}
