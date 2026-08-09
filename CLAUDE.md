# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**Iron Squid** — a public tracker for a Splatoon 3 gauntlet challenge, where the weapon and gear set
are drawn at random and the player has to win with every weapon in the game.

The application is **`apps/web/`** in this repo, an npm workspace. Everything lives here: the app,
the decisions that govern it, and the dev container it is developed in.

The version currently live at [iron-squid.top](https://www.iron-squid.top) is a separate, frozen
Angular repo — [`jvsl.web.angular.iron_squid`](https://github.com/TheHefty/jvsl.web.angular.iron_squid)
— kept as a behavioural reference and as the source of the weapon/gear datasets. It is the only
other repo involved.

The app spent a short while in a repo of its own and was folded back in; `docs/ARCHITECTURE.md`
records why, so the split is not re-proposed without new reasons.

## Read these first

Five documents carry the project's decisions. Do not re-derive from code what they already state,
and do not contradict them silently — if one is wrong, change it deliberately, in its own commit.

| Document | What it owns |
| --- | --- |
| [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) | Where the work stands right now, what to do next, and the traps already hit. Read it first when picking the project back up; it describes the present and is rewritten rather than appended to. |
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

It carries **four turns**, not one: turn 1 is what the app was built from, turn 2 is its light mode,
and turns 3 and 4 are an "inked" Splatoon-themed pass and its light mode. They are the same screens
and routes throughout — presentational only. **Turns 3 and 4 are the adopted target**; turn 1 is what
currently exists. New presentation work goes to the inked set, and the re-skin itself is scheduled
after the persistence work reaches a pausing point.

## Commands

Product commands run from the repo root, which forwards to the `apps/web` workspace:

```bash
npm install     # wires the workspace; run once after cloning
npm run dev     # next dev
npm run build   # next build — runs TypeScript too
npm test        # vitest run
npm run lint    # eslint
npm run format  # prettier --write .
```

The weapon and gear catalogue is **generated and committed**, never hand-edited:

```bash
npm run generate:catalogue   # refetches Leanny/splat3 at the pinned game version
```

Run it only when deliberately moving to a new game version — bump `GAME_VERSION` in
`apps/web/src/data/source.ts` first. `docs/ARCHITECTURE.md` explains why the version is pinned rather
than floating, and why the output is split into one structural file plus one file per language.

The database:

```bash
npm run db:generate   # drizzle-kit generate — reads the schema, writes drizzle/*.sql
npm run db:up         # start the local Postgres and wait for it
npm run db:migrate    # apply drizzle/*.sql to the local Postgres
npm run db:psql       # a shell on it
npm run db:down       # remove it, and its data
```

**Nothing running in this container reaches a container over the network.** The Docker daemon is
behind a socket and its containers are in another network namespace, so a published port does not
listen here and the daemon's bridge shares this container's `172.17.0.0/16` — a container's own IP
resolves back to us. That is why every command above except `db:generate` goes through
`apps/web/scripts/local-db.sh`, which runs the work *inside* the database's network instead of
connecting to it from here. Do not replace them with a direct `drizzle-kit migrate`: it will hang and
then report success against nothing.

The app in development points at a Neon branch for the same reason — `next dev` cannot reach a
container either. The local Postgres exists for the contract test suite, which is headless and runs
in a container happily.

Note that `npm run format` reaches `apps/web` only. The Markdown under `docs/` is deliberately
outside Prettier's scope — do not reformat it as a side effect of editing it.

Node 22 is available in the container (`node --version` → v22). Husky lives at the repo root and
runs `lint-staged` on commit and the test suite on push, so a broken suite does not reach the
remote.

The rest of the commands below are the dev container's own, and run **on the host**, not in here.

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
the tag when it is merged (`release-type: simple` — there is nothing here to publish). Commit
messages are therefore load-bearing: only `feat`/`fix` reach the changelog, and a release is proposed
only when one lands.

It writes the version to `version.txt` and `CHANGELOG.md`, and to the root `package.json` through the
`extra-files` entry in `release-please-config.json`. It does **not** write `package-lock.json`, which
carries the same version twice — npm does not check the root package's version when installing, so
the lock drifting by a release costs nothing and the next `npm install` rewrites it anyway. The
version in `apps/web/package.json` is the workspace's own and is deliberately not tracked: nothing
publishes it, and tying it to the repo's release number would only imply a coupling that is not
there.

**Merge with a merge commit.** That is this project's convention, not a repository setting — GitHub
has no "default merge method" option, only the three enable/disable toggles, and all three are on.
The choice decides which messages the changelog quotes. A merge commit lands every commit from the
branch in `master`, so release-please reads each one and a branch carrying three `feat` commits
produces three changelog entries. **The commit messages on the branch are therefore load-bearing** —
which is the point, because they are also what stays readable in `git log`.

**The pull request title reaches the changelog too**, which is not what this file claimed until #13
proved otherwise. release-please reads the merge commit as well as the branch, and the title arrives
in its body — so a title written as a conventional commit becomes an extra entry alongside the real
ones, usually summarising them. So under a merge commit, **write the pull request title as an
ordinary sentence, not as a `feat:` or `fix:`.** Let the branch's commits carry the changelog and let
the title be what a person reads on GitHub. If one slips through, the entry can be deleted by hand on
release-please's own branch before the release lands; it respects the edit.

Squash is still available, for a branch whose individual commits are not worth keeping — a long
fix-the-fix sequence, say. It inverts which message matters: the whole branch lands as one commit
whose subject is the *pull request title*, so a title that is stale, or is not a conventional commit,
silently costs the changelog its entry. Retitle before squashing.

`master` is protected, so **there is no direct push to it** — every change, including a submodule
bump or a one-line doc fix, goes through a pull request. No approvals are required (single
maintainer), but the rule applies to administrators too, and force-pushes and branch deletion are
blocked. There are no required status checks, because this repo has no CI of its own: a PR here is
mergeable as soon as it is open.

**Head branches are not deleted on merge** (`deleteBranchOnMerge` is `false`). After a merge commit
that costs nothing — the branch's commits are already in `master`. It matters after a squash,
where the branch ref is the only remaining record of how the work was broken up — deleting one
throws that away. `feat/web-app-first-pass` is kept for exactly that reason.

`bootstrap-sha` in `release-please-config.json` pins the changelog's starting point at this repo's
initial commit, `afdcf7f`.
