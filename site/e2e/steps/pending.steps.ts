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

Given('a run in which {int} pieces were re-rolled away', pendingWith('share-rerolls (is-k2f.2.3)'));
Then(
  'the visitor is shown that {int} pieces were re-rolled away',
  pendingWith('share-rerolls (is-k2f.2.3)'),
);
void When;
