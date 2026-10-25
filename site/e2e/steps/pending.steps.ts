// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.

import { Given, Then, When } from '../fixtures';

// Used as `Given('…', pending('<task> (<id>)'))`.
export const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};

// A pending step that takes one parameter must declare it, or the step cannot be generated.
export const pendingWith =
  (task: string) =>
  async ({}, value: unknown) => {
    void value;
    pending(task)();
  };

const runPage = pending('inked-run-page (is-o8k.3.2)');
const sharedRun = pending('inked-shared-run (is-o8k.3.3)');
Then('the ink strip at the top carries several splats', runPage);
Then('its lower edge is slanted', runPage);
Then("the kit's name is in uppercase display type", runPage);
Then("the challenge's rules are shown as tilted stickers, in two columns", runPage);
Given('a run with a win and a loss', runPage);
Then('the win is marked with an ink blot and the loss with an outlined mark', runPage);
Then('each mark says in words whether it was a win or a loss', runPage);
When(
  'a visitor opens a link to a run with {int} kits conquered',
  pendingWith('inked-shared-run (is-o8k.3.3)'),
);
Then('the page leads with a headline about the run', sharedRun);
Then('its kits conquered, kits to go, lives and resets stand in one row', sharedRun);
Given('a device that asks for reduced motion', runPage);
When('a player is given a new set', runPage);
Then("the kit's splat does not move", runPage);
When('a visitor opens the home page', runPage);
When('the visitor opens the home page', runPage);
