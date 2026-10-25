import { describe, expect, it } from 'vitest';
import {
  environmentProblems,
  fromGraphql,
  requiredChecks,
  settingsProblems,
} from './repo-settings';

const goodRepo = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: 'PR_TITLE',
};
const goodBranch = {
  protected: true,
  protection: {
    enabled: true,
    required_status_checks: { contexts: [...requiredChecks], enforcement_level: 'everyone' },
  },
};

describe('settingsProblems', () => {
  it('finds nothing wrong with the settings release-please relies on', () => {
    expect(settingsProblems(goodRepo, goodBranch)).toEqual([]);
  });

  it('requires the squash commit to take the pull request title', () => {
    expect(
      settingsProblems(
        { ...goodRepo, squash_merge_commit_title: 'COMMIT_OR_PR_TITLE' },
        goodBranch,
      ),
    ).toEqual(['squash_merge_commit_title is "COMMIT_OR_PR_TITLE", expected "PR_TITLE"']);
  });

  it('allows only squash merges', () => {
    expect(
      settingsProblems(
        { ...goodRepo, allow_merge_commit: true, allow_rebase_merge: true },
        goodBranch,
      ),
    ).toEqual([
      'merge commits are allowed; only squash merges keep main conventional',
      'rebase merges are allowed; only squash merges keep main conventional',
    ]);
  });

  it('names every required check that is missing', () => {
    const branch = structuredClone(goodBranch);
    branch.protection.required_status_checks.contexts = ['typecheck', 'lint'];
    expect(settingsProblems(goodRepo, branch)).toEqual([
      'main does not require the check "build"',
      'main does not require the check "unit"',
      'main does not require the check "acceptance"',
      'main does not require the check "pr-title"',
      'main does not require the check "repo-settings"',
    ]);
  });

  it('requires the checks to bind administrators too', () => {
    const branch = structuredClone(goodBranch);
    branch.protection.required_status_checks.enforcement_level = 'non_admins';
    expect(settingsProblems(goodRepo, branch)).toEqual([
      'required checks bind "non_admins", expected "everyone"',
    ]);
  });

  it('says so when a setting is not visible, rather than passing', () => {
    expect(settingsProblems({}, { protected: false })).toEqual([
      'squash_merge_commit_title is "<not visible>", expected "PR_TITLE"',
      'squash merges are not allowed',
      'merge commits are allowed; only squash merges keep main conventional',
      'rebase merges are allowed; only squash merges keep main conventional',
      'main is not protected',
    ]);
  });
});

describe('fromGraphql', () => {
  it('reads the merge settings from the GraphQL repository fields', () => {
    expect(
      fromGraphql({
        squashMergeAllowed: true,
        mergeCommitAllowed: false,
        rebaseMergeAllowed: false,
        squashMergeCommitTitle: 'PR_TITLE',
      }),
    ).toEqual(goodRepo);
  });

  it('leaves out what GraphQL did not return, so the check says it is not visible', () => {
    expect(settingsProblems(fromGraphql({}), goodBranch)[0]).toBe(
      'squash_merge_commit_title is "<not visible>", expected "PR_TITLE"',
    );
  });
});

describe('requiredChecks', () => {
  it('include the build, which no longer runs inside acceptance on every pull request (NFR-D5)', () => {
    expect(requiredChecks).toContain('build');
    // Still required: on an ordinary pull request the job is skipped by its own condition, which
    // GitHub counts as passing; on the release pull request it must pass (task release-pipeline).
    expect(requiredChecks).toContain('acceptance');
  });
});

describe('environmentProblems', () => {
  it('accepts a Pages environment that deploys from version tags only (NFR-D8)', () => {
    expect(environmentProblems([{ name: 'v*', type: 'tag' }])).toEqual([]);
  });

  it('refuses one that still deploys from main, or not from tags (failure 2)', () => {
    expect(environmentProblems([{ name: 'main', type: 'branch' }])).toEqual([
      'github-pages deploys from the branch "main"; only a version tag may be published',
      'github-pages does not deploy from the tags "v*"',
    ]);
  });
});
