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

const shareMode = pending('share-mode (is-84v.1.3)');
Given('a player conquered a set in Tower Control', shareMode);
When('a visitor opens a link to the run', shareMode);
When('a visitor opens it', shareMode);
Then('the conquered set is shown with Tower Control', shareMode);
Given('a link to a run made before the site recorded modes', shareMode);
Then('the run is shown as it was, with no mode on its sets', shareMode);
Given(
  'a complete run of {int} kits, each won in a mode, with a display name of {int} characters',
  async ({}, kits: number, length: number) => {
    void [kits, length];
    shareMode();
  },
);
