// What a scenario that builds the site sets up and what the build said, shared between the steps
// that prepare a build, run it, and read its failure.
export const buildState: {
  env: Record<string, string>;
  result?: { status: number; output: string };
  after?: () => Promise<void>;
  expected?: { file: string; digest: string; address: string };
} = { env: {} };
