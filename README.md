# jvsl.monorepo.agents.template

A reference monorepo that has already adopted the
[code-server](https://github.com/coder/code-server)-based dev container template — code-server
itself, the Claude Code CLI, `ai-jail`, the GitHub CLI, a nested rootless Docker daemon, and a
selectable set of tech stacks, all set up.

The template itself lives in its own repo,
[`jvsl.env.agents.code-server`](https://github.com/TheHefty/jvsl.env.agents.code-server), vendored
here as a git submodule at `.code-server/` (mirroring how a `.devcontainer/` would work). Splitting
it out this way means updating the template is a `git submodule update` (bump the pinned commit),
not a rebase against this repo's own history. This repo itself is **not** an application — there's
no product code here, only the root-level scaffolding a consuming monorepo keeps outside the
submodule.

## Getting started

Clone with `git clone --recurse-submodules`, or `git submodule update --init` after a plain clone —
`.code-server/` is empty until the submodule is checked out.

From there, build/run instructions, prerequisites, and the list of available stacks are all in
[`.code-server/README.md`](.code-server/README.md) — this repo doesn't repeat them since they
belong to the template, not to being a consumer of it. The one thing specific to this side of the
submodule boundary is `.code-server.stack.json` at this repo's own root: the per-project stack
selection, written by `.code-server/setup`.

## Docs

- [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — short "how to use this template" guide.
- [`.code-server/docs/OVERVIEW.md`](.code-server/docs/OVERVIEW.md) — inside the submodule: full
  design rationale for the template itself — every decision made, the `core/`/`stacks/` structure,
  the manifest format, and build issues already hit and fixed. Treated as the authoritative,
  up-to-date spec for anything under `.code-server/`; versions together with
  [`jvsl.env.agents.code-server`](https://github.com/TheHefty/jvsl.env.agents.code-server), not
  with this repo.

## License

[MIT](LICENSE)
