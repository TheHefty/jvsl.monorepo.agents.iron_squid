// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.
import { Then, When } from '../fixtures';

const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};
const version = pending('catalogue-version-shown (is-82z.3.3)');

When('a visitor opens any page', version);
Then('the page says the catalogue matches Splatoon 3 version {word}', async ({}, shown: string) => {
  void shown;
  version();
});
