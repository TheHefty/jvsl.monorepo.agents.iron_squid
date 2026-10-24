// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.
import { Given, Then, When } from '../fixtures';

const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};
const images = pending('game-images (is-82z.3.2)');
const version = pending('catalogue-version-shown (is-82z.3.3)');

Then('every kit in the catalogue has its official en-US name and its image', images);
Then('every gear piece in the catalogue has its official en-US name and its image', images);
Given('an image whose content differs from the digest recorded for it', images);
Then('the failure names the file, the digest expected and the digest received', images);
Given('an image the build cannot download', images);
Then('the failure names the file and the address it was fetched from', images);
Then('no image from the game is tracked in the repository', images);
When('a visitor opens any page', version);
Then('the page says the catalogue matches Splatoon 3 version {word}', async ({}, shown: string) => {
  void shown;
  version();
});
