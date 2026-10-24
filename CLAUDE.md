<!-- jvsl.env.agents.container: generated. Delete this line and this file is yours; the extension will
     not touch it again. Keep it and a newer extension may replace the file wholesale. -->

# CLAUDE.md

Guidance for Claude Code working in this repository.

## Standing answers

- **The mode is Pair Programming Mode.** The agent drives, the user navigates. It governs every
  session until somebody says otherwise.
- **The documentation language is English**, including commit messages. Change this line if that is
  wrong for this project, and it stops being true the moment you do.

## Where the rules are

**The modes and the ground rules are not in this file and are not copied into this repository.**
They arrive with the container image and are loaded from the agent's own configuration directory, so
a rule corrected upstream reaches this project when it rebuilds rather than when somebody remembers
to copy it.

Nothing here imports them. That is deliberate: an `@path` import that resolves outside this
directory is classified as *external*, and declining its approval dialog once disables it
permanently with nothing said afterwards — leaving an agent with no modes, no rules and no gates and
no way to tell.

**So if you are an agent reading this and you cannot see the pairing modes or the ground rules in
your context, stop and say so.** Working without them is not working under a lighter process; it is
working with no mode, no rules and no gates, and nothing failed to tell anybody.

## This project's own rules, and the documents read on demand

**This project's own standing rules are in `docs/RULES.md`**, imported here so they are read in every
session. That file is inside this repository, so the import is not an external one. It holds this
project's rules and nothing inherited. Initialization writes it beside `docs/CHARTER.md` and the
SRS; until then the import resolves to nothing, which is expected before the charter and a gap
after it.

@docs/RULES.md

The documents read when they are relevant — `INITIALIZATION.md`, `WORKFLOW.md`, the charter, SRS,
story, task and debt templates — ship with the image at `/opt/jvsl/docs/agent/en/`, with
`/opt/jvsl/docs/agent/pt-BR/` beside it.

## The gates, which are in this file on purpose

They are written here rather than loaded from anywhere, because they have to survive everything
above not arriving:

**Charter, then SRS, then epic, then story with its scenarios, then task with its design, then
code.** Each is agreed with the user before the next is written. A design settled after the code
exists is a justification, and scenarios written after the implementation describe what was built
rather than what was wanted.

**A round of work is planned whole before any of it is built.** Every epic the user's request gives
rise to, and every story under each with its scenarios, is agreed before the first task of any of
them; work found along the way is planned whole too, before its own code.

## This project

**Iron Squid** is a static React website that runs a Splatoon 3 challenge: win with every weapon kit
in the game, each with randomly drawn gear, and replay everything already won when the last life is
lost. Progress stays in the player's browser and is shared as a link. Published on GitHub Pages
from `main`; repository `TheHefty/jvsl.monorepo.agents.iron_squid`, public, MIT for the code and not
for Nintendo's assets.

Read before anything else:

- [`docs/CHARTER.md`](docs/CHARTER.md) — what the project is for, and what it deliberately is not.
- [`docs/SRS.md`](docs/SRS.md) — the numbered requirements, the data map, and the epics and stories.
- [`docs/RULES.md`](docs/RULES.md) — this project's standing rules (imported above).

**Planning lives in the beads tracker, not in files.** Epics, stories and tasks are `bd` items with
the prefix `is-` (`bd list`, `bd show <id>`). A story's acceptance criteria are its `--acceptance`
field, mirrored as Gherkin at `site/e2e/features/<epic>/<story>.feature`, which its `--spec-id`
points to. A draft is a deferred item labelled `proposed` until it is agreed.

The stack is Node 24 (`.agent-container.stack.json`). The site is in `site/`: Vite, React 19,
TypeScript strict, react-intl. From `site/`:

- `npm run build`, then `npm run bdd`: acceptance tests, the registered `.feature` files run by
  playwright-bdd against the production build. Never against the dev server, which has no CSP.
- `npm test` (Vitest), `npm run typecheck`, `npm run lint`.
- **The catalogue is generated, never edited.** `site/catalogue.pin.json` pins the datamine
  (`Leanny/splat3`) to a commit and a data folder, with a digest per source file;
  `npm run catalogue:generate` writes `site/src/catalogue/<version>/` (names and image digests,
  never an image). Moving the pin is its own PR (`docs/RULES.md`): change commit, folder and game
  version, run the generator with `--record-digests`, and review the diff it prints. Version
  folders sort as text, so read the datamine's `versions.json` for the newest, not the last folder.
- **Game images are fetched by the build, never committed.** `npm run build` downloads each image
  in `images.lock.json`, verifies its SHA-256, caches it by digest in `site/.cache/game-images/`
  and publishes it at `/game/<version>/<path>`. Both directories are git-ignored, and `npm test`
  fails if any tracked file has the bytes of a game image.
- **A pull request's title is its commit.** Merges are squash only and take the PR title, which the
  required `pr-title` check holds to a conventional commit. release-please reads those commits, so
  a `fix` titled `chore` is a release that never happens. The release PR is release-please's own;
  merging it tags `vX.Y.Z`.
- A story's `.feature` is listed in `site/e2e/registered-features.ts` by the task that starts it,
  after its scenarios have been seen failing. Scenarios a later task of the same story turns green
  are listed there as `pending`, with that task's name; CI leaves them out, and their steps in
  `site/e2e/steps/pending.steps.ts` fail on purpose if they ever run. Every scenario runs under the guard in
  `site/e2e/fixtures.ts`, which fails it on any off-site request, CSP violation, missing file of the
  site's own or WCAG 2.2 A/AA violation.
