# Architecture

How Iron Squid is built and why. The challenge itself — the thing being tracked — is specified in
[CHALLENGE.md](CHALLENGE.md), and the engineering constraints every change is held to are in
[RULES.md](RULES.md); this document is about the software.

Sections are marked *decided*, *built*, *inherited* or *open* so the difference between a decision
and an implementation stays visible.

## Where the code lives

**Here.** The application is `apps/web/` in this repo, an npm workspace, alongside the docs that
govern it and the dev container it is developed in.

| Repo | Role |
| --- | --- |
| `jvsl.monorepo.agents.iron_squid` (this one) | Everything: the app, the decisions, the docs, the dev container. |
| [`jvsl.web.angular.iron_squid`](https://github.com/TheHefty/jvsl.web.angular.iron_squid) | The original app, live at [iron-squid.top](https://www.iron-squid.top). Frozen: kept as the reference for behaviour and as the source of the datasets, not developed further. |

The app briefly lived in a repo of its own and was folded back in, which is worth recording so it is
not re-proposed without new reasons. Splitting it cost more than it returned: the dev container
mounts *this repository* as its workspace and everything outside it is tmpfs, so a sibling checkout
was not reachable from inside the container at all — the arrangement only worked as an untracked
clone sitting inside this repo, which is a workaround rather than a design. It also put a rule and
the code that rule governs on opposite sides of a boundary, with nothing but discipline keeping them
in step. What the split would have bought — independent CI and releases for the app — is not wanted
yet. Revisit it when it is.

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

### Built so far

The first pass covers the interface and nothing behind it. In `apps/web/`: Next.js 16 on the App
Router, the five screens below against mock data, all five locales, both themes resolved
server-side, and the accessibility baseline plus its four user-controlled options. Note that
Next.js 16 renamed Middleware to **Proxy**, so the locale routing lives in `src/proxy.ts`.

Since then: the challenge rules as a framework-free domain in `src/domain/`, with the RNG injected so
it stays pure and the CSPRNG can live at the server edge; and the generated weapon and gear catalogue
in `src/data/`.

Not built: persistence, route handlers, the PWA layer, and the wiring that would let a page read the
real catalogue instead of `src/lib/mock.ts`. The win/loss buttons are inert.

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
- **An unverified display name, and a leaderboard that needs no login.** This is how the design's
  `@ika_no_9`, its leaderboard and its "Follow this run" button resolve without accounts: the name
  is whatever the player typed and nobody checks it, the leaderboard lists public challenges, and
  "follow" becomes "copy link". Consistent with a challenge whose results are self-reported anyway —
  see [CHALLENGE.md](CHALLENGE.md#identity). It does mean display names are untrusted text and some
  will need removing, which [RULES.md](RULES.md#privacy) already requires.
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

*Built.* Generated from **[`Leanny/splat3`](https://github.com/Leanny/splat3)**, which carries both
halves of the problem:

- **Roster** — `data/mush/<version>/WeaponInfoMain.json` (pinned at version `1120`), plus
  `GearInfoHead/Clothes/Shoes.json`.
- **Localised names** — `data/language/<locale>.json`, under `CommonMsg/Weapon/WeaponName_Main`,
  `CommonMsg/Weapon/WeaponTypeName` and `CommonMsg/Gear/GearName_*`. Locale files map to ours as
  `USen` → `en` *and* `pt-BR`, `USes` → `es-419`, `EUes` → `es-ES`, `JPja` → `ja`.

**The two halves do not join on the same key**, which is the trap in this dataset. Weapons join on
the full `__RowId` (`Shooter_Short_00`). Gear names are keyed on the `__RowId` *without* its slot
prefix — `Hed_AMB000` in the roster is `AMB000` in the language file. Getting this wrong does not
error: it produces a name table that is silently empty, which is exactly how it was first written
here.

**What counts as a weapon:** every row with `Type == "Versus"`, minus the Side Order replicas. Those
are identified by `__RowId` ending in `_O` — 11 rows, including `Brush_Normal_O` (*Orderbrush
Replica*), and the rule deliberately catches nothing else: `Shooter_Normal_H` (*Hero Shot Replica*)
and `Shooter_Normal_Oct` (*Octo Shot Replica*) stay in. Keying off `__RowId` rather than the English
name keeps the filter language-independent. That yields **162 weapons** at version 1120 — a number
the app derives from the file and never hardcodes.

**What counts as drawable gear:** everything except `HowToGet == "Impossible"` and the amiibo family
(`__RowId` beginning `AMB` after the slot prefix). Both cuts are rules of the challenge and are
argued in [CHALLENGE.md](CHALLENGE.md#the-gear-that-is-out-of-the-pool); here they are just a filter.
That yields **245 head, 335 clothes and 226 shoes** — 806 of the dataset's 943.

**Roster order** comes from the weapon's `Id`, which is unique and ascends through the classes in the
order the game itself lists them. `DebugDispOrder` is the field that looks right and is not: it
repeats, so it cannot order the roster on its own.

**Weapon classes** are not a hand-written map. The `__RowId` prefix (`Shooter`, `Maneuver`, …)
matches the keys of `WeaponTypeName` exactly, all eleven, so the class label is localised by the same
lookup as everything else.

### What the generator emits

`npm run generate:catalogue` writes five files into `apps/web/src/data/`:

| File | Contents |
| --- | --- |
| `catalogue.json` | Ids, weapon classes and the game version. Not one word of prose, so it is the same file in every language. |
| `names/USen.json`, `names/USes.json`, `names/EUes.json`, `names/JPja.json` | One language each: weapon names, class labels, gear names. |

The split is the point. The domain draws from ids and never reads a name, so `loadCatalogue(locale)`
in `src/data/catalogue.ts` joins the two halves for the locale being rendered and nothing loads the
other three languages. Adding a sixth language costs one names file.

The judgement — every filter, every join, every sort — lives in `src/data/source.ts` as pure
functions over parsed JSON, unit-tested without a network. `scripts/generate-catalogue.mts` only
fetches, writes and reports. A name the catalogue needs and a language file lacks throws there rather
than rendering as a blank tile; a source whose shape changed throws rather than emitting an empty
roster.

`src/data/catalogue.test.ts` runs against the committed files rather than a fixture, so the data
actually in the repository is checked: no duplicate ids across the three slots, no blank name in any
of the five locales, and — the one that would bite quietly — **every gear pool at least as large as
the roster**. Single use is per item, so a complete run spends 162 pieces per slot; if the roster ever
outgrew a pool, runs would become impossible to finish and the failure would surface as an
`EmptyPoolError` in somebody's last few draws.

### When the catalogue is regenerated

*Decided.* The version is **pinned** (`GAME_VERSION` in `src/data/source.ts`) and the generated files
are **committed**. Regenerating is a deliberate act: bump the constant, run the script, review the
diff, open a PR.

The alternative — reading Leanny's `latest` at build time — keeps the roster current for free, and
was rejected on two counts. Every deploy would depend on someone else's repository being up and
correct, and the roster could change *under a live run* with nobody having decided to let it. That
second point is not hypothetical: what a mid-run roster change should do to a player's progress is
still an open question of the challenge, and floating the dataset would answer it by accident.

Pinning has one real cost, and it is the failure the live site is already in: a roster can go stale
silently. A scheduled job that regenerates and opens a PR would close that without giving up the
hermetic build, and is the obvious next step if it ever bites.

### Replacing the inherited datasets

The Angular app's `WeaponInfo.json` (130 weapons), `GearInfo.json` (912 items) and its 935 gear
images are the starting point, but the JSON is **not** carried over: it is stale *and* wrong. Five
of its names do not exist in current Splatoon 3 data — `Reef-Lux 450`, `Reef-Lux 450 Deco` and
`Wellstringer` are spelling drift from `REEF-LUX 450` and `Wellstring V`, and `Kensa Splattershot`
is a **Splatoon 2** weapon that should never have been in the file. Regenerating from Leanny fixes
all of it and keeps fixing it. The gear images are still worth taking, since the data source
provides names, not art.

Its counts are not ours and should not be quoted as such: the old file's 912 gear items include
pieces that cannot be worn in Versus. The drawable pool is 806. Earlier drafts of
[CHALLENGE.md](CHALLENGE.md) did the single-use arithmetic on the old numbers.

### Open

- **Persistence.** No database chosen. Constrained by the decisions above: server-side draws and
  public pages need real storage, and secret-link ownership needs no user table.
- **Hosting.** The original is on Azure Static Web Apps, which does not fit an app that renders on
  the server and talks to a database.
- **Whether a mid-run roster change disturbs a live run** — stated in
  [CHALLENGE.md](CHALLENGE.md#open-questions), because it is a rule of the challenge before it is a
  data problem, but it lands here too: pinning a run to the roster version it started on means
  storing that version with the run.

The rules themselves are now settled — gear is single-use per item, only Anarchy and X Battle count,
and identity is an unverified display name with no accounts. The domain model is no longer blocked.

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
