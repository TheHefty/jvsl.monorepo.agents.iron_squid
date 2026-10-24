// The scenarios CI does not run: performed by hand (@manual) or after deployment (@deployed).
// Listed so that nobody reads a registered .feature as entirely automated.
import { readFileSync } from 'node:fs';
import { registeredFeatures, registrations } from '../e2e/registered-features';
import { scenariosTagged } from './scenarios';

for (const tag of ['manual', 'deployed']) {
  console.log(`@${tag}:`);
  for (const f of registeredFeatures) {
    for (const name of scenariosTagged(readFileSync(`e2e/features/${f}`, 'utf8'), tag)) {
      console.log(`  ${f}: ${name}`);
    }
  }
}

console.log('pending (left out of CI until the named task turns them green):');
for (const r of registrations) {
  for (const [name, task] of Object.entries(r.pending ?? {}))
    console.log(`  ${r.feature}: ${name} — ${task}`);
}
