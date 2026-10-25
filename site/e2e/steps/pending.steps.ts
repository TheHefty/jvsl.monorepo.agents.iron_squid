// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.
import { Given, Then, When } from '../fixtures';

const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};
const notKept = pending('not-kept-notice (is-82z.8.2)');
const older = pending('older-catalogue (is-82z.8.3)');

Given('a browser that does not let the site store anything', notKept);
When('the player opens the site', notKept);
Then('the player is told the run will not be kept when the page closes', notKept);
Then('the player is offered to export it instead', notKept);
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
