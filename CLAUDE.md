# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A reference monorepo that has already adopted the code-server dev-container template. The template
itself — `core/`, `stacks/`, `start/`, `setup`, and the full design-rationale doc — lives in its own
repo, [`jvsl.env.agents.code-server`](https://github.com/TheHefty/jvsl.env.agents.code-server),
vendored here as a git submodule at `.code-server/` (the officially documented way to consume it —
not a copy-paste drop-in). Splitting it out means any monorepo consuming the template pulls in
template updates with a plain `git submodule update` (bump the pinned commit) instead of needing a
rebase against upstream template history.

This repo is not itself an application — there's no product code here, only the root-level
scaffolding a consuming monorepo keeps outside the submodule: this `CLAUDE.md`, `README.md`,
`docs/OVERVIEW.md`, and `.code-server.stack.json` (the per-project stack selection — see "Manifest"
in `.code-server/docs/OVERVIEW.md` for why it can't live inside the submodule itself).

Full design rationale for the template — every decision made, the exact structure of
`core/`/`stacks/`, the manifest format, and every build error hit and fixed along the way — is
recorded in `.code-server/docs/OVERVIEW.md`, inside the submodule (so it versions together with the
template, not with this consuming repo). Treat that file as the authoritative, up-to-date spec for
anything under `.code-server/`. `docs/OVERVIEW.md` at this repo's root is the short user-facing "how
to use this template" version, and is what should be updated for anything specific to being a
*consumer* of the template (as opposed to the template's own internals).

## Pair Programming Mode

By default, treat work in this repo as guided pair programming, not delegated implementation:
work through open design questions one at a time — present 2-3 options with a short tradeoff and
a recommendation, let the user pick, then move to the next item. Don't front-load a full design
doc or make several decisions on the user's behalf in one pass. Only write or edit code once the
user gives an explicit go-ahead for that scoped piece of work (e.g. "go ahead", "do it all")
— don't implement unilaterally before that. If there's a genuine verification gap (e.g. no
toolchain available locally to build/run something), say so plainly before writing and let the
user decide how to handle it, rather than claiming untested code works.

When this template is added to a new project (bootstrapping, via `git submodule add
https://github.com/TheHefty/jvsl.env.agents.code-server.git .code-server`), the agent must start by
asking about the project's purpose — domain, goals, and
any constraints already known — before touching files. Update the base files (`README.md`,
`CLAUDE.md`, `docs/OVERVIEW.md`, and any stack selection in `.code-server.stack.json` at the
consuming repo's root) to reflect the answers, and propose/assemble an initial structure for the
new project based on them, following the one-decision-at-a-time approach above rather than
generating the whole thing unprompted.

## Commands

Build the dev image (interactive; also how you add/remove stacks later):
```bash
.code-server/setup
```
Requires `jq`, `whiptail`, and `docker` on the host. This runs on the host, before any image
exists, so it cannot depend on anything from inside the image it builds.

Build the native launcher (Rust/Tauri, only needed once, or after editing `.code-server/start/src/main.rs`):
```bash
cd .code-server/start && cargo build --release
```
Requires Rust and the Tauri Linux prerequisites (webkit2gtk, etc. — exact packages per distro are
in `.code-server/docs/OVERVIEW.md`). There is no test suite and no lint config in this repo. The
template itself does have CI, inside the submodule (`.code-server/.github/workflows/ci.yml`):
`bash -n` over the shell scripts, `cargo check --release --locked` on `start/` (the `--locked` is
what keeps a stale `Cargo.lock` from reaching you here as a dirty submodule), and a `docker build`
per stack (each composed through `core/compose-dockerfile.sh`, so a stack's `requires.json`
dependencies are built with it) — plus `ci-green`, a job that needs all of the others and is the
single check the template's branch protection requires, since the per-stack jobs are a matrix built
from `ls stacks` and their names change whenever a stack is added or removed. Changes under
`.code-server/` are therefore verifiable there, but nothing in this consuming repo runs it.

Launch the environment:
```bash
.code-server/start/target/release/start
```

## Architecture

- **`.code-server/core/Dockerfile.frag`** — the mandatory base layer (code-server, Node.js,
  Claude Code CLI, `ai-jail`, the GitHub CLI, Rust/`rustup` + the Tauri Linux libs). Never optional.
  Two parts of it are worth knowing before touching anything else: **Docker inside the container is
  a nested *rootless* daemon**, run as the s6 service in `core/services/svc-dockerd-rootless/` —
  the host's socket is deliberately not mounted, because mounting it made everything in the
  container root-equivalent on the host and silently voided `ai-jail`'s sandbox (an agent shown a
  read-only path can `docker exec -u 0` into its own container); and `CLAUDE_CONFIG_DIR=/config/.claude`
  keeps the whole Claude Code CLI state in the bind-mounted directory rather than only its
  credentials. `core/cont-init/` now holds a single boot hook, `20-kvm-gid.sh`, which aligns the
  in-container `kvm` group with the host device's gid when `start` passed one.
- **`.code-server/stacks/<name>/`** — one directory per selectable tech stack, each with a
  `Dockerfile.frag` (using a `{{VERSION}}` placeholder, substituted at compose time — version
  divergence within a stack is handled with a shell `if` inside the same fragment, not a separate
  directory per version), a `versions.json` listing valid versions, and optionally a
  `requires.json` listing other stacks it can't build without and a `cont-init/` directory of
  boot-time scripts the fragment `COPY`s into `/custom-cont-init.d/` (the same LinuxServer hook
  `core/` uses — for anything that must hold on *every* boot rather than once at build time, which
  for a stack usually means state under `/config`, a named volume Docker seeds from the image only
  on first mount). Current stacks: `java`, `cpp`, `dotnet`, `python`, `golang`, `ruby`, `php`,
  `node`, `rust`, `android` (the only one with a `requires.json`: `["java"]`, and so far the only
  one with a `cont-init/`) — `java` was the original, meant as the pattern to copy for new ones.
- **`.code-server/setup`** — bash script: reads `.code-server.stack.json` at the consuming repo's
  root (one level above `.code-server/` — the versioned manifest, the source of truth for stack
  selection; lives outside the submodule so it survives `git submodule` updates instead of being
  local, uncommittable state inside vendored code), shows a `whiptail` multi-select checklist
  pre-populated from it, refuses a selection that leaves a `requires.json` dependency unchecked,
  asks a version per selected stack, rewrites the manifest, then exports it as `STACK_MANIFEST` and
  calls `core/compose-dockerfile.sh` to generate `.code-server/Dockerfile` (gitignored — always
  regenerated, never hand-edited), and runs `docker build`. Removing a stack is just excluding it
  from the manifest; there's no uninstall logic, the image is always rebuilt from scratch.
- **`.code-server/core/compose-dockerfile.sh`** — takes stack names and writes the Dockerfile to
  stdout: `core/Dockerfile.frag` followed by each stack's fragment, `requires.json` dependencies
  first, `{{VERSION}}` substituted. Versions come from the JSON file `$STACK_MANIFEST` points at
  when it has an entry for the stack, and otherwise from the lowest version in that stack's
  `versions.json` — which is exactly what lets `setup` (exports the manifest it just wrote) and CI
  (exports nothing, gets the lowest listed version it already tests) share one composition path
  instead of each concatenating fragments on its own.
- **`.code-server/start/`** — a Tauri v2 Rust app with no JS frontend (`dist/index.html` is an
  unused placeholder; the window navigates straight to code-server's external URL). `src/main.rs`
  ensures the container is running (`docker start` if it already exists, otherwise a `docker run`
  replicating the flags a plain `docker run` setup would need — workspace and `~/.claude` mounts
  plus the named `/config` volume, `PUID/PGID=1000`, `--cap-add=SYS_ADMIN`, `--memory=8g` with
  `--memory-swap=10g` (i.e. 2g of swap), and `--cpuset-cpus` over half the host's cores so `nproc`
  inside reflects the limit), reads back the host port Docker published for it, polls the
  code-server URL until it responds, then opens a native window there instead of a browser tab
  (deliberately, to avoid the browser intercepting editor keyboard shortcuts like Ctrl+W/Ctrl+N).
  It deliberately does *not* use `--network host`: code-server is published as `-p
  127.0.0.1:0:8443` (a free host port, loopback only) so several projects' containers can run at
  once — see "Networking and port discovery" in `.code-server/docs/OVERVIEW.md`. Image/container
  name, data volume name and `START_WORKSPACE_DIR` default-derive automatically (from the binary's
  own location, and from the same basename convention `setup` uses for the image name), so it runs
  with no configuration as long as it stays inside the repo structure it was built in. Three device
  nodes are passed through *conditionally*, only when the host has them (`docker run --device` on a
  missing path is a hard failure, not a no-op): `/dev/fuse` and `/dev/net/tun`, which the nested
  rootless daemon needs for fuse-overlayfs and slirp4netns — without `/dev/fuse` the daemon stays
  down instead of crash-looping, so `docker` inside simply isn't available — and `/dev/kvm`, which
  the `android` stack's headless emulator needs, passed together with a `KVM_GID` the boot hook
  reads.
- **Versioning** — the template is released with release-please from its own conventional commits;
  `v1.0.0` is the first tag. Prefer bumping `.code-server/` to a tag rather than a bare commit, and
  read the submodule's `CHANGELOG.md` when bumping across one. A bare commit is not just less
  tidy: if it came from a branch that is later squash-merged, the commit becomes unreachable and
  every fresh clone fails its `git submodule update`. The template's own `main` is protected and
  requires `ci-green`, and its release-please runs under a PAT (`RELEASE_PLEASE_TOKEN`) so that its
  release PRs get a CI run at all — a token that expires, and whose expiry shows up as releases
  quietly no longer being proposed. See "Versioning and releases" in
  `.code-server/docs/OVERVIEW.md`.

## Releases

This repo is released the same way the template is: release-please
(`.github/workflows/release-please.yml`) keeps a release PR open on `master` and cuts the tag when
it is merged, with `version.txt` + `CHANGELOG.md` as the only versioned artifacts (`release-type:
simple` — there is nothing here to publish). Commit messages are therefore load-bearing, not
decoration: only `feat`/`fix` reach the changelog, and a release is proposed only when one of them
lands.

`master` is protected, so **there is no direct push to it** — every change, including a submodule
bump or a one-line doc fix, goes through a pull request. No approvals are required (single
maintainer), but the rule applies to administrators too, and force-pushes and branch deletion are
blocked. There are no required status checks, because this repo has no CI of its own: a PR here is
mergeable as soon as it is open. Head branches are deleted automatically on merge.

`bootstrap-sha` pins the changelog's starting point at `54628be`, the commit that vendored the
template as a submodule. Everything before it describes `core/`/`stacks/` work that has since moved
into the template's own repo, and letting release-please walk into it would produce a changelog
about code this repo no longer contains.
