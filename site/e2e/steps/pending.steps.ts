// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.
import { Given, Then } from '../fixtures';

const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};
const older = pending('older-catalogue (is-82z.8.3)');

Given('a player with a run started on catalogue version {word}', async ({}, version: string) => {
  void version;
  older();
});
Given('the site has since been rebuilt from a newer catalogue version', older);
Then('the run continues against catalogue version {word}', async ({}, version: string) => {
  void version;
  older();
});
Then('the player is told the run is on an older catalogue', older);
Then('kits added since are not part of the run', older);
