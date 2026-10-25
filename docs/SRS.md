# Software Requirements Specification

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-10-24 |
| **Author** | João Lima, with Claude |

What Iron Squid must do, agreed before any story is written. It is built against the
[charter](CHARTER.md), and where the two disagree the charter wins until it is re-grilled. This
document is also the source of truth for the epics and stories: the work tracker (`bd`) mirrors the
last section, and when the two disagree, this document is right.

Requirements are numbered so stories and tasks can cite them. A requirement is stated so that someone
could look at the running site and say whether it holds.

## Terms

- **Kit** — a weapon as the game's weapon select shows it: a main weapon with its fixed sub and
  special. *Splattershot* and *Tentatek Splattershot* are two kits.
- **Replica** — a kit that is cosmetically different but identical in play to another kit: the Order
  replicas, *Hero Shot Replica*, *Octo Shot Replica* and *Plastic-Bottle Shot Replica*. Replicas
  are not kits for the challenge.
- **Gear piece** — one headgear, clothing or shoes item.
- **Set** — a kit and the three gear pieces drawn with it.
- **Conquered** — a set the player has won with in the current run.
- **Run** — one attempt at the challenge, from the first draw until every kit is conquered.
- **Reset** — what happens when the last life is lost: the run returns to its first set.
- **Catalogue version** — the game data the site was built from, named by the game version it
  matches (for example `11.3.0`).

## Functional requirements

### Catalogue

- **FR-1** The site knows every kit available in online battles in the catalogue version it was
  built from, with replicas excluded. For the current data (game version 11.3.0) that is **160 kits**.
- **FR-2** The site knows every headgear, clothing and shoes piece a player can wear in online
  battles. Gear the game marks as unobtainable for multiplayer — such as Hero Mode and Side Order
  gear — is excluded.
- **FR-3** Every kit and gear piece is shown with its official name in the active locale (see
  NFR-I2) and its image from the game.
- **FR-4** The site states which catalogue version it was built from, on every page.

### A run

- **FR-10** A player can start a run. Starting one while another is in progress asks for
  confirmation and says that the current run will be discarded.
- **FR-11** A player may give the run a display name of up to 30 characters, and of at most 300
  bytes in UTF-8, so the longest name still fits in a share link (NFR-P2). It is optional, and the
  site works the same without one.
- **FR-12** Each new set is drawn at random: a kit not yet conquered in this run, and one headgear,
  one clothing and one shoes piece not yet used in this run.
- **FR-13** A gear piece, once drawn, is never drawn again in the same run. That includes after a
  reset: a conquered set keeps its gear.
- **FR-14** A drawn set cannot be re-drawn, skipped or swapped. Reloading the page, closing the
  browser or opening the site in a new tab shows the same set. The order of every draw in a run is
  fixed when the run starts, so undoing and re-reporting a result (FR-20) never changes which set
  comes next.
- **FR-15** The player reports the result of each match as a win or a loss.
- **FR-16** A run starts with **1 life**. The player earns **1 life for every 10 wins** since the
  run started or since its last reset, whichever is later. Wins during a replay count.
- **FR-17** A loss costs one life. If lives remain, the player plays the same set again.
- **FR-18** When a loss leaves **0 lives**, the run resets. The player then replays the conquered
  sets in the order they were first conquered, with the same gear, and has 1 life. Once every
  conquered set has been won again, the draws resume.
- **FR-19** During a replay, the site makes clear that the set is a replay, and how many conquered
  sets remain before new draws.
- **FR-20** The player can undo the last reported result. The undo is available until the next
  result is reported, and it returns lives, the set and the progress exactly as they were before.
- **FR-21** The run is complete when every kit in the catalogue is conquered. The site then says so,
  and shows the number of matches, wins, losses and resets it took.
- **FR-22** At any moment the site shows: kits conquered out of the total, lives, wins towards the
  next life, the current set, and the number of resets so far.
- **FR-23** After a win, the site shows the set just conquered, and the next set appears when the
  player asks for it.
- **FR-24** The run keeps a log of every reported match, in the order played: the set, the result,
  the lives left after it, whether it was a replay, and when it was reported; a reset is marked
  where it happened. The player can read the whole log, newest first. Undoing a result (FR-20)
  removes its entry.

### Keeping progress

- **FR-30** A run in progress survives the page being reloaded, the browser being closed and the
  device being restarted, on the same browser.
- **FR-31** The player can export the run to a file and import it on another browser or device,
  where it continues exactly where it was.
- **FR-32** Importing a file that is not a valid run, or that names a catalogue version the site
  does not carry, is refused with a message that says which of the two it is. An import never
  overwrites the current run without confirmation.
- **FR-33** If the catalogue version changes while a run is in progress — the site was rebuilt from
  newer game data — the run continues against the catalogue version it was started with. The site
  says so, and kits added since are not part of that run. The site therefore carries every
  catalogue version it has ever been built from.

### Sharing a run

- **FR-40** The player can copy a link that shows the run as it is at that moment.
- **FR-41** Anyone who opens the link sees the run, read-only: its display name if any, kits
  conquered out of the total, the conquered sets in order, current lives, resets, and whether it is
  complete. Nothing on that view can change the run, or the visitor's own run.
- **FR-42** A link opened by a visitor who has a run of their own does not replace it, and offers a
  way back to it.
- **FR-43** The run is carried in the link itself. Opening one requires nothing but the site.
- **FR-44** A link that is malformed, or that names a catalogue version the site no longer has,
  shows a message saying which of the two, never a blank page or a partial run.

### Notices

- **FR-50** Every page links to the terms of use, the privacy notice and the security policy.
- **FR-51** Every page carries a notice that the site is a fan project, not affiliated with or
  endorsed by Nintendo, and that Splatoon names and images are Nintendo's.

## Non-functional requirements

### Delivery and operation

- **NFR-D1** The site is static: HTML, CSS, JavaScript and images, published to GitHub Pages from
  `main`. There is no server-side code.
- **NFR-D2** At runtime the site makes **no requests to any host but its own**: no fonts, scripts,
  images or analytics from third parties. A Content Security Policy enforces it.
- **NFR-D3** The game's images are **not committed to the repository**. The build downloads them
  from the datamine at a pinned commit, and verifies each file against a committed SHA-256 digest.
  A missing file or a digest mismatch fails the build and names the file, the expected digest and
  the one received.
- **NFR-D4** The kit and gear catalogue, with the names in every locale, is **generated** from the
  same pinned datamine commit by a script in the repository, and the generated data is committed, so
  that a game update reaches the site as a reviewable diff. Moving the pin is a deliberate change,
  never automatic.
- **NFR-D5** A pull request that breaks the build, the tests, the accessibility check or the
  catalogue checks (NFR-D3, NFR-D6, NFR-I7) cannot be merged: they are required status checks on
  `main`.
- **NFR-D6** The build checks that each gear slot has at least as many pieces as there are kits, so
  that FR-13 can always be satisfied, and fails if it does not.
- **NFR-D7** The site is served from the project's own domain, over HTTPS only, through GitHub Pages.

### Performance

- **NFR-P1** On a mid-range phone, the first screen is usable without waiting for the catalogue's
  images: images load as they are needed, not all at once.
- **NFR-P2** A share link for a complete run fits in **2,000 characters**, so that it survives the
  places players paste it into.

### Accessibility

- **NFR-A1** The site meets **WCAG 2.2 level AA**.
- **NFR-A2** Everything can be done with a keyboard alone, in a logical order, with focus always
  visible.
- **NFR-A3** Native controls and semantic HTML are used before ARIA.
- **NFR-A4** A new draw, a result, a reset and the end of a run are announced to screen readers.
- **NFR-A5** Every kit and gear image has its name as its text alternative.
- **NFR-A6** Colour contrast and text sizes are defined once, in design tokens. Nothing is conveyed by
  colour alone.
- **NFR-A7** Any animation, such as of a draw, respects the system's reduced-motion setting.
- **NFR-A8** An automated accessibility check runs in CI on every page and every state of a run.

### Internationalization

- **NFR-I1** Every user-facing string lives in a message catalogue keyed by identifier, from the
  first commit. Translated fragments are never concatenated into sentences, and plurals are handled
  by the catalogue, not by code.
- **NFR-I2** The site is offered in the 14 locales Splatoon 3 ships in — `en-US`, `en-GB`, `es-ES`,
  `es-MX`, `fr-FR`, `fr-CA`, `de-DE`, `it-IT`, `nl-NL`, `ru-RU`, `ja-JP`, `ko-KR`, `zh-CN`, `zh-TW` —
  and in `pt-BR`.
- **NFR-I3** Kit and gear names are the official names for the locale, taken from the game data. In
  `pt-BR`, which the game does not ship, they are the `en-US` names.
- **NFR-I4** The interface text is translated per language, with regional differences only where
  the game itself differs. A translation not reviewed by a fluent speaker is marked as unreviewed in
  its catalogue, and the README lists which ones are.
- **NFR-I5** The first visit uses the browser's preferred language when the site offers it, and
  `en-US` otherwise. The player can change it on every page, and the choice is remembered.
- **NFR-I6** Numbers and dates are formatted for the active locale.
- **NFR-I7** The build fails if a locale is missing a key the default locale has.
- **NFR-I8** Every locale has its own address (`/en-US/`, `/ja-JP/`, `/pt-BR/`…), and the site's
  root sends a visitor to one by NFR-I5. A link to an address in a locale opens in that locale,
  whatever the visitor's remembered choice.

## Data and legal

**The project processes no personal data.** Nothing a player enters or does is sent anywhere
by the site: there is no server, no account, no analytics and no third-party request (NFR-D2).
That is what the table records, and it is the decision that keeps everything below short.

This is scaffolding, not legal advice. Nothing here has been reviewed by someone qualified, and the
policy texts that follow from it will not have been either.

### Data map

| Data | Why | Where it lives | Who processes it | How long |
|---|---|---|---|---|
| Run state: sets, results, lives, resets, and the log of matches with the date each was reported | To play the run (FR-30) and read it back (FR-24) | The player's browser storage | The player's own browser; never sent | Until the player starts another run or clears site data |
| Run display name (optional) | To show on a shared run (FR-11) | The player's browser storage, and any link the player makes | Only whoever the player sends the link to | As above; in a link, for as long as the link exists wherever it was pasted |
| Language choice | To remember it (NFR-I5) | The player's browser storage | The player's own browser | Until site data is cleared |
| Exported run file | To move a run (FR-31) | Wherever the player saves it | The player | The player's decision |
| DNS queries for `iron-squid.top` | Resolving the domain | Cloudflare's nameservers; HostGator is the registrar | **Cloudflare**, as DNS provider, under its own privacy policy. Every record is DNS only, never proxied, so Cloudflare sees the resolvers' queries and never a visitor's requests to the site | Cloudflare's retention |
| IP address, user agent, requested URL | Serving the site | GitHub's infrastructure | **GitHub**, as host, under its own privacy statement; the project has no access to these logs | GitHub's retention |

- **The run is carried in the link's fragment** (`#…`), not in its path or query string. A browser
  never sends the fragment to the server, so the run and its display name never reach GitHub's logs.
- **The display name is the only free text a player enters.** The site tells the player, where they
  type it, that it will be visible to anyone who receives a link they share. It is not checked or
  moderated, because the project never receives it.
- **Browser storage holds only what the site needs to function** (the run and the language), so no
  consent banner is required. Re-check this the moment anything else is stored.

### Legal baseline

- **LGPD (Lei 13.709/2018).** The site is public, so the law is in scope. The project is not a
  controller of personal data, because it receives none. The only processing that happens is by
  GitHub as host. The privacy notice says that, and names GitHub.
- **Marco Civil da Internet (Lei 12.965/2014).** The terms of use and the privacy notice must be
  clear and reachable (FR-50). On keeping access records (art. 15): the project has no access to
  them and keeps none. Whether the obligation applies at all to a non-commercial project run by a
  natural person is **to be confirmed by someone qualified**, against the law as it stands, not
  against this document.
- **Nintendo's intellectual property.** Names and images belong to Nintendo. The site says so on
  every page (FR-51), and the images are not committed (NFR-D3), so that a takedown request can be
  met by stopping the publication without rewriting the repository's history.
- **The datamine has no licence.** It is a record of Nintendo's data, not a work licensed to us. It is
  treated as a source of Nintendo's assets, under the bullet above, not as a dependency with terms
  of its own.
- **Subject requests.** None can be answered with data, because the project holds none; the privacy
  notice says how to ask anyway — a GitHub issue, or the private contact in `SECURITY.md` for
  anything sensitive — and that a request about the host's logs goes to GitHub.

## Epics and stories

Three epics, in the order they are built.

### `run-in-the-browser` — A player can play a whole Iron Squid run on the published site.

The site in English only (`en-US`), with the i18n seam already in place.

- **`site-online`** — The site is published on GitHub Pages from `main`, with the build, the tests and
  the accessibility check gating every pull request. (NFR-D1, NFR-D2, NFR-D5, NFR-D7, NFR-A8)
- **`notices`** — The terms of use, privacy notice and fan disclaimer are reachable from every page.
  (FR-50, FR-51)
- **`catalogue`** — The site knows every kit and gear piece, with names and images, from the pinned
  datamine. (FR-1–FR-4, NFR-D3, NFR-D4, NFR-D6)
- **`draw-a-set`** — A player starts a run and gets a set they cannot skip or re-draw. (FR-10–FR-14)
- **`report-a-match`** — A player reports wins and losses, earns and loses lives, and can undo the last
  report. (FR-15–FR-17, FR-20, FR-22, FR-23)
- **`reset-and-replay`** — Losing the last life sends the run back through every conquered set.
  (FR-18, FR-19)
- **`finish-a-run`** — Conquering the last kit ends the run and says what it took. (FR-21)
- **`keep-progress`** — A run survives the browser closing, and moves between devices as a file.
  (FR-30–FR-33)
- **`run-log`** — A player can read every match of their run, wins and losses, in order. (FR-24)

### `share-a-run` — Anyone can see a player's run from a link they were sent.

- **`share-link`** — A player copies a link that carries their run. (FR-40, FR-43, NFR-P2)
- **`view-shared-run`** — Opening a link shows the run read-only, without touching the visitor's own,
  and explains a broken or outdated link. (FR-41, FR-42, FR-44)

### `every-language` — The site can be used in every language Splatoon 3 ships in, and in Brazilian Portuguese.

- **`choose-language`** — The first visit follows the browser's language, and the player can change it
  anywhere. (NFR-I5, NFR-I8)
- **`localized-names`** — Kits and gear carry their official names in every locale. (NFR-I3)
- **`translate-interface`** — The interface is translated into every offered locale, with unreviewed
  translations marked. (NFR-I2, NFR-I4, NFR-I6, NFR-I7)

## Alternatives considered

- **Do nothing, and run the challenge on a spreadsheet** — rejected: the random draw, the
  once-per-run gear and the replay order are exactly what a player gets wrong or bends by hand.
- **A backend with accounts and a leaderboard** — rejected in the charter: it brings personal data,
  moderation and hosting costs for a feature the share link covers.
- **Committing the game's images** — rejected: Nintendo's assets would sit in the history forever,
  and a takedown would reach the whole repository.
- **Loading images from a third-party host at runtime** — rejected: every visitor's IP would reach
  that host, and the site would break whenever the host changed.
- **Curating the catalogue by hand** — rejected: 14 locales of names for hundreds of items, re-typed
  on every game update.
- **Counting main weapons instead of kits (~70 wins)** — rejected: the challenge is every weapon, and
  a kit is what the player selects.
- **Filtering gear by what the player owns** — rejected in the charter.
- **Carrying the run in the query string** — rejected: it would reach the host's logs; the fragment
  does not.

## Outcome

Agreed on 2026-10-24 by João Lima, owner, at the SRS gate (PR #4), as written. The choices made
while drafting were confirmed with it rather than changed: lives counted from the start or the last
reset (FR-16), undo of the last result (FR-20), the optional display name (FR-11), a run pinned to
its catalogue version (FR-33), and the exclusion of Hero Mode and Side Order gear (FR-2).

Amended on 2026-10-24 at the story grilling (PR #6): the custom domain (NFR-D7), an address per
locale (NFR-I8), a draw order fixed at the start of the run (FR-14), the next set on request
(FR-23), a 30-character limit on the display name (FR-11), and FR-32 reworded to agree with FR-33,
which now says the site carries every catalogue version it was built from. The amendment closed a
gap the grilling found: undo, as first written, let a player re-roll a set by undoing a win and
reporting it again.

Amended on 2026-10-24 when the catalogue story started (PR #35): the counts in FR-1 were read from
game version 9.3.0, because the datamine's version folders were sorted as text and `930` looked like
the newest; the newest is `1130`. Game version 11.3.0 has 160 kits: 174 versus weapons, less 14
cosmetic replicas, one more than first counted (*Plastic-Bottle Shot Replica*). The 30 kits added
since 9.3.0 are Sheldon's Picks. The datamine pin is unchanged; its data folder is `1130`. The
stories' scenarios that quoted 130 kits or version 9.3.0 change with this amendment.

Amended on 2026-10-24 when the visual design was adopted (PR #42): the design proposed a run log,
every win and every loss of the run in order, which fits the charter (it lives in the browser with
the run) but no requirement covered. FR-24 and the `run-log` story add it. The design's other
additions — a leaderboard, community progress, following runs, handles, a history of past runs and
a re-roll button — were left out: the first five need a server the charter rules out, and a re-roll
breaks FR-14.

Amended on 2026-10-25 when the share-a-run epic started (task share-codec): FR-11 also caps the
display name at 300 bytes. A character as the player sees it can be any number of code points (an
emoji family is 25 bytes, and accents can be stacked without end), so 30 characters alone could not
keep NFR-P2's 2,000 characters for a link. Ordinary names, emoji included, never reach the cap. A
run stored with a longer name before the cap stays readable; its share link leaves the name out.
The draw-a-set story gains a scenario for the cap.

