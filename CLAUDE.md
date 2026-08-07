# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**Iron Squid** — a public tracker for a Splatoon 3 gauntlet challenge, where the weapon and gear set
are drawn at random and the player has to win with every weapon in the game. This monorepo is where
it is being rebuilt as a server-backed public tracker.

There is **no application code here yet**. What exists is the dev container (vendored as a
submodule), the release plumbing, and the documents below. The version currently live at
[iron-squid.top](https://www.iron-squid.top) is a separate, frozen Angular repo,
[`jvsl.web.angular.iron_squid`](https://github.com/TheHefty/jvsl.web.angular.iron_squid), kept as a
behavioural reference and as the source of the weapon/gear datasets.

## Read these first

Four documents carry the project's decisions. Do not re-derive from code what they already state,
and do not contradict them silently — if one is wrong, change it deliberately, in its own commit.

| Document | What it owns |
| --- | --- |
| [`docs/CHALLENGE.md`](docs/CHALLENGE.md) | The rules of the challenge, and the project's vocabulary (*challenge* / *run* / *draw* / *match* — note that **run** means one attempt, not the whole thing). Source of truth for behaviour. Its "Open questions" section blocks the domain model. |
| [`docs/RULES.md`](docs/RULES.md) | Security, privacy and development non-negotiables. Read before writing code, not after review. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the software is built and why: decisions taken and their rationale, what was learned from the original Angular app, the screen→route map, and what is still undecided. |
| [`docs/OVERVIEW.md`](docs/OVERVIEW.md) | The dev container — prerequisites, building the image, starting the environment. Human-facing; an agent working inside the container rarely needs it. |
| [`SECURITY.md`](SECURITY.md) | The public vulnerability-disclosure policy. Outward-facing, unlike `docs/RULES.md`; edit it when the reporting channel or the scope changes. |

The rules in `docs/RULES.md` that most often catch new work: domain logic is framework-free and
never lives in components, every bug fix ships with a regression test for its exact scenario, game
data is read from the dataset rather than hardcoded, no user-facing string is written in a component
(five locales — `en`, `pt-BR`, `es-419`, `es-ES`, `ja`), and style comes from the Nocturne tokens
rather than literal values.

## Pair Programming Mode

By default, treat work in this repo as guided pair programming, not delegated implementation:
work through open design questions one at a time — present 2-3 options with a short tradeoff and
a recommendation, let the user pick, then move to the next item. Don't front-load a full design
doc or make several decisions on the user's behalf in one pass. Only write or edit code once the
user gives an explicit go-ahead for that scoped piece of work (e.g. "go ahead", "do it all")
— don't implement unilaterally before that. If there's a genuine verification gap (e.g. no
toolchain available locally to build/run something), say so plainly before writing and let the
user decide how to handle it, rather than claiming untested code works.

When a decision gets made in conversation, it belongs in `docs/ARCHITECTURE.md` (or
`docs/CHALLENGE.md` if it is a rule of the challenge) — a decision that only exists in a chat log is
one that will be re-litigated.

## Design

The UI comes from the Claude Design project *Splatoon Challenge Tracker Website*
(`cd5d3fc1-e1ae-4df5-a326-9000e01a6967`), read through the `DesignSync` tool. `Armory Run.dc.html`
holds the screens; `_ds/nocturne-*/styles.css` is the **Nocturne** design system and the source of
truth for the look — dark #161826 ground, a #9184d9 blurple accent used as line and glow and never
as a flood, outlined primary buttons, Inter at weight 500 with no bolder step, a deliberately dense
0.7× spacing scale, Phosphor icons. `_ds/nocturne-*/readme.md` documents the system's intent;
`support.js` is only the runtime that renders the `.dc.html` preview format and has nothing to port.

The design doc offers alternatives per screen. The chosen ones, and the route each maps to, are
recorded in `docs/ARCHITECTURE.md`. Note the design's nav says "ARMORY RUN"; the brand is **Iron
Squid**.

## Commands

There is no application yet, so there is no build, test or lint command for product code. Node 22 is
available in the container (`node --version` → v22).

Build the dev image (interactive; also how you add/remove stacks later):
```bash
.code-server/setup
```
Requires `jq`, `whiptail`, and `docker` **on the host** — it runs before the image exists, so it
cannot depend on anything inside it.

Build the native launcher (Rust/Tauri; once, or after editing `.code-server/start/src/main.rs`):
```bash
cd .code-server/start && cargo build --release
```

Launch the environment:
```bash
.code-server/start/target/release/start
```

## The dev container

The [code-server template](https://github.com/TheHefty/jvsl.env.agents.code-server) is vendored as a
git submodule at `.code-server/`, pinned to **v1.0.2**. It is consumed, not maintained here: bumping
it is a `git submodule update` to a new tag, never a rebase.

`.code-server/docs/OVERVIEW.md`, inside the submodule, is the authoritative and up-to-date spec for
everything under `.code-server/` — the `core/`/`stacks/` structure, the manifest format, and every
build issue already hit and fixed. Read it there rather than trusting a summary here. The parts
worth knowing without opening it:

- **`.code-server.stack.json`** at this repo's root is the stack selection (currently `node: 22`).
  It lives outside the submodule deliberately, so it survives submodule updates. `.code-server/setup`
  reads it, rewrites it, composes `.code-server/Dockerfile` from it, and builds. That Dockerfile is
  gitignored and always regenerated — never hand-edit it.
- **Docker inside the container is a nested rootless daemon**, not the host's socket. Mounting the
  host socket would make everything in the container root-equivalent on the host and silently void
  `ai-jail`'s sandbox. It needs `/dev/fuse`; without it the daemon stays down and `docker` simply
  is not available inside.
- **`CLAUDE_CONFIG_DIR=/config/.claude`** keeps the whole Claude Code CLI state in the bind-mounted
  directory, not just credentials.
- Bumps pin to a **tag**, never a bare commit — a commit from a squash-merged branch becomes
  unreachable and breaks `git submodule update` for every fresh clone. Read the submodule's
  `CHANGELOG.md` when crossing one.

## Releases

release-please (`.github/workflows/release-please.yml`) keeps a release PR open on `master` and cuts
the tag when it is merged, with `version.txt` + `CHANGELOG.md` as the only versioned artifacts
(`release-type: simple` — there is nothing here to publish). Commit messages are therefore
load-bearing: only `feat`/`fix` reach the changelog, and a release is proposed only when one lands.

`master` is protected, so **there is no direct push to it** — every change, including a submodule
bump or a one-line doc fix, goes through a pull request. No approvals are required (single
maintainer), but the rule applies to administrators too, and force-pushes and branch deletion are
blocked. There are no required status checks, because this repo has no CI of its own: a PR here is
mergeable as soon as it is open. Head branches are deleted automatically on merge.

`bootstrap-sha` in `release-please-config.json` pins the changelog's starting point at this repo's
initial commit, `afdcf7f`.
