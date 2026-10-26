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

const showBrand = pending('show-brand (is-k2f.1.2)');
Then("the headgear, the clothing and the shoes each show their brand's icon", showBrand);
When('the player reads the current set', showBrand);
Then("each gear piece's brand is read by its name", showBrand);
Given('a player on the {string} address with a set drawn', pendingWith('show-brand (is-k2f.1.2)'));
Then('each brand is named in Japanese', showBrand);
When('a visitor opens a link to a run with conquered sets', showBrand);
Then("each conquered set's gear shows its brand's icon", showBrand);
