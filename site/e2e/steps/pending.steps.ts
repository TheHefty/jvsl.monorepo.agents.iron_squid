// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.

import { Given, Then, When } from '../fixtures';

// Used as `Given('…', pending('<task> (<id>)'))`.
export const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};

const switcher = pending('language-switcher (is-8el.1.1)');
Given('a locale whose translation no fluent speaker has reviewed', switcher);
When("a visitor is on that locale's address", switcher);
Then('the page says the translation has not been reviewed', switcher);
Then('the language switcher marks that language as unreviewed', switcher);
