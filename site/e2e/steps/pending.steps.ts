// Steps of scenarios registered as pending (e2e/registered-features.ts). CI leaves those scenarios
// out; these exist only so the files can be generated. Each fails, naming the task that will write
// it, so a pending scenario that somehow runs turns red with its reason instead of passing. The task
// replaces its steps here with real ones and removes its scenarios from the pending list.

// Used as `Given('…', pending('<task> (<id>)'))`, importing Given/Then/When from '../fixtures'.
export const pending = (task: string) => () => {
  throw new Error(`pending: this step is written by the task ${task}`);
};

// No scenario is pending at the moment.
