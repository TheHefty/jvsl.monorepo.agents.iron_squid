# Architecture

How Iron Squid is built and why. The challenge itself — the thing being tracked — is specified in
[CHALLENGE.md](CHALLENGE.md), and the engineering constraints every change is held to are in
[RULES.md](RULES.md); this document is about the software.

**Status: nothing in "The application" below is built yet.** This repo currently holds the
dev-container submodule, the release plumbing and these docs. Sections are marked *decided*,
*inherited* or *open* so the difference between a decision and an implementation stays visible.

## Where the code lives

| Repo | Role |
| --- | --- |
| `jvsl.monorepo.agents.iron_squid` (this one) | The product going forward. |
| [`jvsl.web.angular.iron_squid`](https://github.com/TheHefty/jvsl.web.angular.iron_squid) | The original app, live at [iron-squid.top](https://www.iron-squid.top). Frozen: kept as the reference for behaviour and as the source of the datasets, not developed further. |

### What the original app is

Worth recording, because it is the baseline the rewrite is measured against. Angular 21 + NgRx 21 +
Angular Material, persisted to IndexedDB through `ngx-indexed-db`, deployed as static files on Azure
Static Web Apps. No backend of any kind: no HTTP calls, the weapon and gear datasets compiled into
the bundle, and every challenge living in the browser that played it.

That last point is the reason for the rewrite. A tracker whose state cannot leave the device cannot
have public run pages, shareable links or a leaderboard — the entire product idea added on top of
it. Going public is not a feature bolted onto that app; it is a layer it structurally lacks.

Four things carried over from reading it, recorded so they are not reintroduced:

- **The rules lived in a UI component.** All of the draw, lives and reset logic sat in
  `gear-set-card.component.ts`, a presentational card. Untestable, and impossible to enforce
  anywhere but the client.
- **Re-rolling was unrestricted.** A `rerollGear` handler re-drew any slot, including the weapon,
  with no limit. Harmless in a private tracker; fatal to a public one, where it voids rules 1 and 3.
- **Losing matches were not recorded.** A defeat was only written to history when it was the last
  life, so intermediate losses vanished — and the run log is supposed to show deaths.
- **The finish line was hardcoded** to 129, against a dataset of 130 and a game that has since
  gained more weapons. The count must come from the data.

## The application

### Decided

- **One Next.js app** (App Router, TypeScript) rather than a separate SPA and API. The public run
  page *is* the product — the thing pasted into Discord — so it has to render on the server, with
  real content and a link preview. The original app serves an empty shell with only a `<title>`,
  which is exactly the failure mode to avoid. Route handlers cover the API surface; a Discord bot or
  stream overlay can be served later from the same handlers.
- **React, not Angular.** A deliberate rewrite of the frontend rather than adding a backend to the
  existing app.
- **Secret-link ownership, no accounts.** Creating a challenge returns a public read URL and a
  secret edit URL. No auth, no password reset, no email. The data model still carries a nullable
  owner field, so a challenge can be claimed later if accounts are ever added — the point is to
  avoid painting the schema into a corner, not to build accounts now.
- **The server owns the randomness.** Draws are produced server-side and persisted before they are
  shown. This is the one rule the honour system cannot cover: self-reported results are visible and
  socially checkable, but a client that can re-roll until it likes the weapon defeats the challenge
  silently. See [CHALLENGE.md](CHALLENGE.md#consequences-worth-stating-outright) for the reasoning
  and [RULES.md](RULES.md#security) for what it obliges.
- **Nocturne design system**, taken from the Claude Design project *Splatoon Challenge Tracker
  Website*. Plain CSS over tokens — `--color-*`, `--space-*`, `--radius-*`, `--shadow-*` — with a
  #161826 ground and a #9184d9 blurple accent used as line and glow, never as a flood. Primary
  buttons are outlines, not fills; headings are Inter at weight 500 and never bolder; the spacing
  scale is deliberately dense (0.7×); icons are Phosphor. Its `styles.css` is copied in as the base
  layer and built against with its own classes rather than reimplemented.
- **Brand: Iron Squid**, keeping the existing domain and the name its players know. The design mocks
  say "ARMORY RUN" in the nav; that is replaced.

### Screens

From the design doc `Armory Run.dc.html`. It offered alternatives for two screens; the chosen ones
are marked, and the rejected variants are left in the design project rather than copied here.

| Route | Screen | Design |
| --- | --- | --- |
| `/` | Landing — split hero with the live roll card beside it | 1b *(chosen over 1a)* |
| `/run/[id]` | Run dashboard — lives, streak, replay queue, armory grid | 1c |
| `/run/[id]/armory` | The armory — dense tile grid, state by fill | 1d *(chosen over 1e)* |
| `/run/[id]/log` | Run log — every win and every death | 1g |
| `/r/[token]` | Public run page — the shareable one | 1h |

Mock 1f is not a route: it is 1c at 390px, so the dashboard is built responsive rather than as a
separate mobile screen.

### Internationalisation

Five locales: **`en`, `pt-BR`, `es-419`, `es-ES`, `ja`**, served with **next-intl**.

- **The locale is always in the URL** — `/pt-BR/r/abc123`, never a bare `/r/abc123`. The product is a
  link pasted into Discord, and a URL whose content depends on the reader's cookie renders
  differently for each of them, caches wrong and produces an unstable link preview. Prefixing
  everything also gives each language its own indexable URL and avoids two spellings of one route.
- **Game data is localised too**, not just the interface: a Japanese player expects スプラシューター,
  not "Splattershot". Names come from the dataset per locale (see below).
- **`pt-BR` shows English proper names.** Splatoon 3 has no Portuguese localisation — there is no
  official Brazilian name for any weapon or gear, and inventing one would be worse than not
  translating. Brazilian players already use the English names for exactly this reason. The
  interface is fully translated; the nouns stay English.
- **Both Spanishes are carried**, because they are genuinely different: 201 of 326 weapon names
  differ between the Latin American and European datasets — `Blaster_LightLong_00` is *Turbolanzamotas
  Pro* in one and *Superdevastador* in the other. One would be wrong for half the audience.
- English needs no such split: the EU and US datasets are identical across all 326 weapon names.
- **Japanese needs a CJK font.** Nocturne specifies Inter, which has no CJK coverage; a Noto Sans JP
  fallback is declared in the token layer, or the browser silently substitutes and the page loses
  its typography.
- **Dates, numbers and plurals go through `Intl`.** The design's `2 Aug, 23:41` and `40 / 139` are
  formatted, never assembled by hand.
- Copy is translated with an ear for voice. The design's English is deliberately dry and mean
  ("Nobody has finished this.", "lie at your own social cost") and does not survive a literal pass.

### Progressive web app

Built as an installable PWA with **Serwist** (the maintained Workbox-based successor to `next-pwa`,
which is effectively stalled and weak on the App Router). The target is the real usage pattern: a
phone on the sofa next to a Switch, reporting a result between matches — which is exactly what mock
1f is.

**Installable.** Web app manifest, maskable icons, `display: standalone`, and `theme-color` on
Nocturne's #161826 ground so the system chrome matches the page instead of flashing white.

**Offline is deliberately asymmetric — reads work, the game does not advance.** Pages already
visited open without a network; reporting a win or a loss is accepted immediately and queued through
Background Sync, draining when the connection returns. The *next draw* still requires the server.

That last limitation is not an oversight, it is the design holding: the server owns the randomness
precisely so a client cannot produce or repeat a draw, and any offline mode that hands the next
weapon to the device trades that away. The alternative considered was pre-issuing the next draw
along with the current one, which would allow fully offline play and would still prevent re-rolling
— but it reveals the next weapon before the current one is won, and that changes how the challenge
feels. Read-and-queue keeps both the rule and the feel; the cost is honest and small.

**Queued writes must be idempotent.** A Background Sync entry can be replayed — the browser retries,
the tab is restored, the same result gets sent twice. Every reported match carries a
client-generated idempotency key and the server ignores a repeat, or one bad connection silently
costs a life or credits a weapon twice.

**Precache the shell only.** The art is 19 MB across ~1,100 images; downloading that before a
visitor has decided to use the site is not acceptable on mobile data. Weapon and gear images are
cached at runtime as they appear, with an entry cap and expiry, so an active run accumulates its own
art naturally.

**The service worker never caches an edit route.** The secret link is a credential in a URL, and a
service worker adds a Cache Storage that persists on the device after the tab closes — on a possibly
shared phone. Only public routes and the shell are cacheable. See [RULES.md](RULES.md#security).

Locale-aware caching falls out of the routing decision for free: because the locale is always in the
path, `/ja/r/abc` and `/pt-BR/r/abc` are distinct cache entries with no extra work. Under a
cookie-based scheme the service worker would have had to vary on it by hand.

### Accessibility and theming

**WCAG 2.2 AA is a hard requirement**, not a goal — see [RULES.md](RULES.md#accessibility). The
Nocturne palette carries it almost everywhere: body text measures 14.5:1 on the dark ground and
13.0:1 on the light one, and the dark accent #9184d9 is 5.45:1, comfortably past AA despite the
system's own conservative "at least 3:1" note.

**Two themes.** Dark is the default and the system's native ground; light was added to the design as
turn 2, with a Dark/Light segmented control in the nav. The light theme is a genuine retune rather
than an inversion — the ramps swap roles (`--color-accent-800` goes from #423a6a to #d2cefd) and the
accent drops to #796cbf.

The theme choice must be **readable on the server**, so it is persisted in a cookie and rendered
into the first response. Under SSR, deriving it on the client instead means every shared link paints
the wrong theme and then corrects itself — on the one page the product exists to have shared.
`prefers-color-scheme` supplies the initial default and nothing more.

Note that the light mocks cover 1a, 1c/1d and 1f; there is no light version of **1b**, the landing
that was chosen. The tokens define it unambiguously, so this is a gap in the mocks, not a decision.

#### Deviations from the mocks

Implementing the design literally would ship contrast failures. These are corrections, applied in
both themes, and the mocks are wrong where they disagree:

| What | Dark | Light | Needs | Fix |
| --- | --- | --- | --- | --- |
| "Untouched" tile vs the page | 1.24:1 | 1.13:1 | 3:1 | A visible border on the untouched tile |
| "Current" tile vs the page | ok (#b5abfc border) | 1.13:1 | 3:1 | Give the light theme the same border treatment |
| Tile code text | 2.91:1 | 3.50:1 (4.09:1 when cleared) | 4.5:1 | One ramp step deeper |
| Muted text (`.45` / `#75798c`) | 3.91:1 | 3.96:1 | 4.5:1 | One ramp step deeper |
| Accent as body text | 5.45:1, passes | 4.10:1 | 4.5:1 | `#5d5294` (6.23:1), as Nocturne's readme already prescribes |

The distinction *between* states is fine in both themes (4.38:1 dark, 3.62:1 light) — what is missing
is the boundary against the page, which is why a border fixes it without disturbing the look.

#### Baseline, not optional

- **The armory is a list, not 162 unlabelled divs.** The mocks render each weapon as
  `<div title="…">`: `title` is not reliably announced and a div takes no focus, which makes the
  product's central progress display invisible to screen readers and unreachable by keyboard. It
  becomes a real list with a per-weapon accessible name carrying the state ("Splattershot, cleared").
- **Lives are labelled in text.** `●●●○○` is announced as "black circle black circle white circle".
  The marks stay as decoration behind an accessible label.
- **The roll animation respects `prefers-reduced-motion`.** It cycles weapon names every 70 ms for
  ~16 ticks; unreadable at that rate and a vestibular problem besides.
- `<html lang>` tracks the locale, which the always-prefixed URL gives for free.
- Keyboard reachability, visible focus (Nocturne already defines a 2px `:focus-visible` ring), and a
  skip link.

#### User-controlled options

Four, all shipping in v1, on top of respecting the OS-level `prefers-reduced-motion` and
`prefers-contrast`:

- **Reduce motion** — an in-site toggle as well, for people whose system setting does not match what
  they want here.
- **State by shape, not colour alone** — fill, outline and a symbol on the armory tiles, so
  cleared / current / untouched survive any colour vision.
- **High contrast** — a theme beyond the AA minimum.
- **Text size** — an in-app scale, on top of a layout in relative units that survives browser zoom.

### Game data

Generated from **[`Leanny/splat3`](https://github.com/Leanny/splat3)**, which carries both halves of
the problem and joins them on one key (`__RowId`, e.g. `Shooter_Short_00`):

- **Roster** — `data/mush/<version>/WeaponInfoMain.json` (current version `1120`), plus
  `GearInfoHead/Clothes/Shoes.json`.
- **Localised names** — `data/language/<locale>.json`, under `CommonMsg/Weapon/WeaponName_Main` and
  `CommonMsg/Gear/GearName_*`. Locale files map to ours as `USen` → `en` *and* `pt-BR`, `USes` →
  `es-419`, `EUes` → `es-ES`, `JPja` → `ja`.

**What counts as a weapon:** every row with `Type == "Versus"`, minus the Side Order replicas. Those
are identified by `__RowId` ending in `_O` — 11 rows, including `Brush_Normal_O` (*Orderbrush
Replica*), and the rule deliberately catches nothing else: `Shooter_Normal_H` (*Hero Shot Replica*)
and `Shooter_Normal_Oct` (*Octo Shot Replica*) stay in. Keying off `__RowId` rather than the English
name keeps the filter language-independent.

That yields **162 weapons** at version 1120 — a number the app derives at build time and never
hardcodes.

### Replacing the inherited datasets

The Angular app's `WeaponInfo.json` (130 weapons), `GearInfo.json` (912 items) and its 935 gear
images are the starting point, but the JSON is **not** carried over: it is stale *and* wrong. Five
of its names do not exist in current Splatoon 3 data — `Reef-Lux 450`, `Reef-Lux 450 Deco` and
`Wellstringer` are spelling drift from `REEF-LUX 450` and `Wellstring V`, and `Kensa Splattershot`
is a **Splatoon 2** weapon that should never have been in the file. Regenerating from Leanny fixes
all of it and keeps fixing it. The gear images are still worth taking, since the data source
provides names, not art.

### Open

- **Persistence.** No database chosen. Constrained by the decisions above: server-side draws and
  public pages need real storage, and secret-link ownership needs no user table.
- **Hosting.** The original is on Azure Static Web Apps, which does not fit an app that renders on
  the server and talks to a database.
- **When the dataset is regenerated.** The source is settled (see [Game data](#game-data)); the
  refresh policy is not. Fetching from Leanny at build time keeps the roster current on its own but
  makes every deploy depend on someone else's repo; committing the generated file and refreshing it
  deliberately keeps builds hermetic but can go stale — which is the failure the live site is
  already in. A generated file committed to the repo, refreshed by a scheduled job that opens a PR,
  gets both, at the cost of a workflow to maintain.
- **Whether a mid-run roster change disturbs a live run.** Splatoon 3 adding weapons changes the
  finish line under players who are part-way through. Growing the target mid-run is one answer;
  pinning a run to the roster version it started on is another.
- The rule-level open questions in [CHALLENGE.md](CHALLENGE.md#open-questions), which shape the
  domain model and so block it.

## Repository plumbing

- **Dev container.** The [code-server template](https://github.com/TheHefty/jvsl.env.agents.code-server)
  is vendored as a submodule at `.code-server/`, pinned to `v1.0.2`. Stack selection lives in
  `.code-server.stack.json` at this repo's root — currently `node: 22`. See
  [OVERVIEW.md](OVERVIEW.md) for how to build and start it.
- **Releases.** release-please (`release-type: simple`) keeps a release PR open on `master` and cuts
  the tag when it is merged; `version.txt` and `CHANGELOG.md` are the only versioned artifacts. Only
  `feat` and `fix` commits reach the changelog and only they propose a release, so commit messages
  are load-bearing.
- **`master` is protected.** No direct pushes, including for one-line doc fixes and submodule bumps
  — everything goes through a PR. No approvals required and no required status checks (this repo has
  no CI of its own), so a PR is mergeable as soon as it is open. Head branches are deleted on merge.
