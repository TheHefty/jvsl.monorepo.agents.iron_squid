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
const pendingWith =
  (task: string) =>
  async ({}, value: unknown) => {
    void value;
    pending(task)();
  };
const translations = pending('translations (is-8el.3.2)');
const switcher = pending('language-switcher (is-8el.1.1)');
Given('a visitor on any of the {int} locale addresses', pendingWith('translations (is-8el.3.2)'));
Then("every text on every page is in that locale's language", translations);
Then('so are the notices, the error messages and the screen-reader announcements', translations);
Given('a visitor on the {string} address', pendingWith('translations (is-8el.3.2)'));
Then(
  "the number of lives is written with that language's plural form for {int}",
  pendingWith('translations (is-8el.3.2)'),
);
Then('numbers and dates are written as German writes them', translations);
Given('a locale whose translation no fluent speaker has reviewed', switcher);
When("a visitor is on that locale's address", switcher);
Then('the page says the translation has not been reviewed', switcher);
Then('the language switcher marks that language as unreviewed', switcher);
