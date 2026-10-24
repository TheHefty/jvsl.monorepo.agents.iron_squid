// Run after the acceptance suite: fails when the run executed fewer scenarios than the registered
// features declare, so a tag filter, a generation step or a config change that drops scenarios
// fails the job instead of leaving it green with nothing tested. With --deployed, it checks the
// smoke run against the published site, which executes only the @deployed scenarios.
import { readFileSync } from 'node:fs';
import { pendingScenarios, registeredFeatures } from '../e2e/registered-features';
import { countScenarios, countScenariosTagged, missingFromRun } from './scenarios';

type Suite = { suites?: Suite[]; specs?: { tests: { projectName: string; status: string }[] }[] };

const deployed = process.argv.includes('--deployed');
const report = JSON.parse(
  readFileSync(`e2e/test-results/${deployed ? 'deployed' : 'acceptance'}.json`, 'utf8'),
) as Suite;
// The acceptance suite runs once per colour scheme; each run must execute every scenario.
const projects = deployed ? ['deployed'] : ['acceptance-dark', 'acceptance-light'];
const tests = (s: Suite): { projectName: string; status: string }[] => [
  ...(s.specs ?? []).flatMap((sp) => sp.tests),
  ...(s.suites ?? []).flatMap(tests),
];
const expected = registeredFeatures
  .map((f) => readFileSync(`e2e/features/${f}`, 'utf8'))
  .map((src) =>
    deployed
      ? countScenariosTagged(src, 'deployed')
      : countScenarios(src, ['manual', 'deployed'], pendingScenarios),
  )
  .reduce((a, b) => a + b, 0);

let failed = false;
for (const project of projects) {
  const executed = tests(report).filter(
    (t) => t.projectName === project && t.status !== 'skipped',
  ).length;
  const problem = missingFromRun({ expected, executed });
  if (problem) {
    console.error(`${project}: ${problem}`);
    failed = true;
  } else {
    console.log(`${project}: ${executed} of ${expected} expected scenario(s) executed`);
  }
}
if (failed) process.exit(1);
