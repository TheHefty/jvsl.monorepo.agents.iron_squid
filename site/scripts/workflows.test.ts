import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// What the workflows must keep true for the release gate (task release-pipeline). Read as text: the
// lines that matter are short and named, and a YAML parser would only add a dependency.
const ci = readFileSync('../.github/workflows/ci.yml', 'utf8');
const deploy = readFileSync('../.github/workflows/deploy.yml', 'utf8');
const job = (text: string, name: string) => {
  const start = text.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`test: no job ${name}`);
  const next = text.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
  return next < 0 ? text.slice(start) : text.slice(start, start + 1 + next);
};
// The branch release-please opens its pull request from (release-please's default, for main).
const releaseBranch = 'release-please--branches--main';

describe('the acceptance job', () => {
  const acceptance = job(ci, 'acceptance');
  const condition = /\n {4}if: (.+)\n/.exec(acceptance)?.[1] ?? '';

  it('is skipped on ordinary pull requests by its own condition, so its required check still passes (failure 1)', () => {
    expect(condition).not.toBe('');
    // Not by a filter on the trigger: a workflow filtered out reports nothing, and a required
    // check that never reports blocks every pull request.
    expect(ci).toMatch(/\non:\n {2}pull_request:\n/);
    expect(ci).not.toMatch(/pull_request:\n {4}(paths|branches)/);
  });

  it("runs on release-please's pull request (failure 3)", () => {
    const prefix = /startsWith\(github\.head_ref, '([^']+)'\)/.exec(condition)?.[1] ?? '';
    expect(prefix).not.toBe('');
    expect(releaseBranch.startsWith(prefix)).toBe(true);
  });

  it('runs whenever the workflow is called rather than run for a pull request', () => {
    expect(condition).toContain("github.event_name != 'pull_request'");
  });
});

describe('the deploy workflow', () => {
  it('publishes when a release is published, never on a push to main (NFR-D8)', () => {
    expect(deploy).toMatch(/\non:\n {2}release:\n {4}types: \[published\]\n/);
    expect(deploy).not.toMatch(/\n {2}push:\n/);
  });

  it('reruns every check, acceptance included, on the release before publishing', () => {
    expect(job(deploy, 'verify')).toContain('uses: ./.github/workflows/ci.yml');
    expect(job(deploy, 'build')).toContain('needs: verify');
    expect(job(deploy, 'deploy')).toContain("if: github.event_name == 'release'");
  });
});
