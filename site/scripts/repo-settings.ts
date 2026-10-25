// The repository settings the release discipline rests on, read back on every pull request so that
// one changed in the GitHub interface fails CI instead of drifting silently (task release-please).
// Squash merges take the PR title, which pr-title has checked, and that title is the commit
// release-please reads; any other merge method puts an unchecked message on main.
import { fileURLToPath } from 'node:url';

// acceptance stays required although it runs on release-please's pull request only: on any other
// its job is skipped by its own condition, which GitHub counts as passing (task release-pipeline).
export const requiredChecks = [
  'build',
  'typecheck',
  'lint',
  'unit',
  'acceptance',
  'pr-title',
  'repo-settings',
] as const;

type Repo = {
  allow_squash_merge?: boolean;
  allow_merge_commit?: boolean;
  allow_rebase_merge?: boolean;
  squash_merge_commit_title?: string;
};
type Branch = {
  protected?: boolean;
  protection?: {
    enabled?: boolean;
    required_status_checks?: { contexts?: string[]; enforcement_level?: string };
  };
};

type GraphqlRepo = {
  squashMergeAllowed?: boolean;
  mergeCommitAllowed?: boolean;
  rebaseMergeAllowed?: boolean;
  squashMergeCommitTitle?: string;
};

// The REST API hides the merge settings from a token without admin rights, which GITHUB_TOKEN never
// has; GraphQL returns them to anyone who can read the repository.
export function fromGraphql(r: GraphqlRepo): Repo {
  const repo: Repo = {};
  if (r.squashMergeAllowed !== undefined) repo.allow_squash_merge = r.squashMergeAllowed;
  if (r.mergeCommitAllowed !== undefined) repo.allow_merge_commit = r.mergeCommitAllowed;
  if (r.rebaseMergeAllowed !== undefined) repo.allow_rebase_merge = r.rebaseMergeAllowed;
  if (r.squashMergeCommitTitle !== undefined)
    repo.squash_merge_commit_title = r.squashMergeCommitTitle;
  return repo;
}

export function settingsProblems(repo: Repo, branch: Branch): string[] {
  const problems: string[] = [];
  if (repo.squash_merge_commit_title !== 'PR_TITLE') {
    problems.push(
      `squash_merge_commit_title is "${repo.squash_merge_commit_title ?? '<not visible>'}", expected "PR_TITLE"`,
    );
  }
  if (repo.allow_squash_merge !== true) problems.push('squash merges are not allowed');
  if (repo.allow_merge_commit !== false)
    problems.push('merge commits are allowed; only squash merges keep main conventional');
  if (repo.allow_rebase_merge !== false)
    problems.push('rebase merges are allowed; only squash merges keep main conventional');
  if (branch.protected !== true || branch.protection?.enabled !== true) {
    problems.push('main is not protected');
    return problems;
  }
  const checks = branch.protection.required_status_checks;
  for (const name of requiredChecks) {
    if (!checks?.contexts?.includes(name))
      problems.push(`main does not require the check "${name}"`);
  }
  if (checks?.enforcement_level !== 'everyone') {
    problems.push(
      `required checks bind "${checks?.enforcement_level ?? '<not visible>'}", expected "everyone"`,
    );
  }
  return problems;
}

type DeploymentPolicy = { name?: string; type?: string };

// The Pages environment publishes version tags and nothing else (NFR-D8): a branch policy would let
// a push to main reach players without a release.
export function environmentProblems(policies: DeploymentPolicy[]): string[] {
  const problems = policies
    .filter((p) => p.type === 'branch')
    .map(
      (p) =>
        `github-pages deploys from the branch "${p.name}"; only a version tag may be published`,
    );
  if (!policies.some((p) => p.type === 'tag' && p.name === 'v*'))
    problems.push('github-pages does not deploy from the tags "v*"');
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) {
    console.error('repo-settings: set GITHUB_REPOSITORY (owner/name) and GITHUB_TOKEN');
    process.exit(1);
  }
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' };
  const branchRes = await fetch(`https://api.github.com/repos/${repository}/branches/main`, {
    headers,
  });
  if (!branchRes.ok)
    throw new Error(`repo-settings: GET branches/main answered ${branchRes.status}`);
  const [owner, name] = repository.split('/');
  const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) {
    squashMergeAllowed mergeCommitAllowed rebaseMergeAllowed squashMergeCommitTitle } }`;
  const gqlRes = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables: { owner, name } }),
  });
  const gql = (await gqlRes.json()) as { data?: { repository?: GraphqlRepo }; errors?: unknown };
  if (!gqlRes.ok || gql.errors) {
    throw new Error(
      `repo-settings: GraphQL answered ${gqlRes.status} ${JSON.stringify(gql.errors ?? '')}`,
    );
  }
  const policiesRes = await fetch(
    `https://api.github.com/repos/${repository}/environments/github-pages/deployment-branch-policies`,
    { headers },
  );
  if (!policiesRes.ok)
    throw new Error(
      `repo-settings: GET the github-pages deployment policies answered ${policiesRes.status}`,
    );
  const { branch_policies: policies = [] } = (await policiesRes.json()) as {
    branch_policies?: DeploymentPolicy[];
  };
  const problems = [
    ...settingsProblems(fromGraphql(gql.data?.repository ?? {}), await branchRes.json()),
    ...environmentProblems(policies),
  ];
  for (const p of problems) console.error(`repo-settings: ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(`repo-settings: ${repository} has the settings the release discipline relies on`);
}
