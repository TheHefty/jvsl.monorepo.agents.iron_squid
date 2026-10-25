// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.

import { Then, When } from '../fixtures';

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

const sharedRun = pending('inked-shared-run (is-o8k.3.3)');
When(
  'a visitor opens a link to a run with {int} kits conquered',
  pendingWith('inked-shared-run (is-o8k.3.3)'),
);
Then('the page leads with a headline about the run', sharedRun);
Then('its kits conquered, kits to go, lives and resets stand in one row', sharedRun);
