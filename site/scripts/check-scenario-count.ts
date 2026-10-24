// Run after the acceptance suite: fails when the run executed fewer scenarios than the registered
// features declare, so a tag filter, a generation step or a config change that drops scenarios
// fails the job instead of leaving it green with nothing tested.
import { readFileSync } from 'node:fs';
import { registeredFeatures } from '../e2e/registered-features';
import { countScenarios, missingFromRun } from './scenarios';

type Suite = { suites?: Suite[]; specs?: { tests: { projectName: string; status: string }[] }[] };

const report = JSON.parse(readFileSync('e2e/test-results/acceptance.json', 'utf8')) as Suite;
const tests = (s: Suite): { projectName: string; status: string }[] => [
  ...(s.specs ?? []).flatMap((sp) => sp.tests),
  ...(s.suites ?? []).flatMap(tests),
];
const executed = tests(report).filter(
  (t) => t.projectName === 'acceptance' && t.status !== 'skipped',
).length;
const expected = registeredFeatures
  .map((f) => countScenarios(readFileSync(`e2e/features/${f}`, 'utf8'), ['manual', 'deployed']))
  .reduce((a, b) => a + b, 0);

const problem = missingFromRun({ expected, executed });
if (problem) {
  console.error(problem);
  process.exit(1);
}
console.log(`acceptance: ${executed} of ${expected} expected scenario(s) executed`);
