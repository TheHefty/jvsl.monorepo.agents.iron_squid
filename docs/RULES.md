# Iron Squid — project rules

These are **this project's own** standing rules, and nothing else. The inherited ground rules and
modes arrive with the container image at `~/.claude/rules` and are loaded with no import; they are
not copied here. Each rule below follows from a decision in the [charter](CHARTER.md) or the
[SRS](SRS.md), and says which, so it can be dropped when that decision changes.

## Data stays on the player's device

- **Nothing the site does sends data anywhere but its own host.** No analytics, no fonts, scripts or
  images from a CDN, no error reporter, no "just a ping". The data map in the SRS says the project
  processes no personal data, and one third-party request makes that false without anything
  failing. The Content Security Policy is what enforces it (NFR-D2): widen it only in a change that
  also amends the data map, the privacy notice and the charter.
- **The run travels in the URL fragment, never in the path or the query string.** The fragment is
  the only part of a URL a browser does not send to the server (SRS, Data map).
- **Browser storage holds the run and the language, and nothing else.** Anything more is a new row
  in the data map, and a reason to re-check whether consent is now needed.
- **The display name is the only free text a player types, and it is never sent anywhere.** If a
  change would send it, the change is a charter change.

## Nintendo's assets

- **Game images are never committed.** Not one, not as a placeholder, not in a test fixture. The
  build fetches them (NFR-D3). Once a Nintendo asset is in the history, it is in every clone forever,
  and a takedown reaches the whole repository.
- **Every fetched asset is checked against a committed SHA-256 digest**, and the datamine is pinned
  to a commit, never to a branch. The datamine's `main` moves when the game updates: a build that
  follows it changes under the project with no change in the project.
- **Moving the datamine pin is its own pull request**, carrying the regenerated catalogue and the new
  digests. The PR says which game version it moves to, and what the diff added or removed: a
  kit removed in an update means a run in progress has a kit that no longer exists.
- **The fan-project notice stays on every page** (FR-51). It is the honest statement of what the
  site is.

## The challenge rules are the product

- **A change to how draws, lives, resets or replays behave is a charter change**, not a bug fix. The
  rules in the charter are what players hold their runs to, and a run started under one set of
  rules and finished under another is not a run anyone can compare.
- **The randomness and the run's rules are tested through the run, not through a helper.** A test of
  the shuffle function proves the shuffle; it does not prove that a reload cannot re-draw.

## Strings and locales

- **No user-facing literal in the code.** Every string is a catalogue key (NFR-I1), from the very
  first component, including error messages and the text alternatives for images.
- **Kit and gear names come from the generated catalogue only.** They are never typed by hand, never
  translated by us, and never corrected locally — a wrong name is fixed upstream or with a new pin.
- **A machine or agent translation is marked unreviewed** in its catalogue until a fluent speaker has
  reviewed it (NFR-I4). An unmarked translation reads as reviewed.

## Legal texts

- **The privacy notice and the terms of use have not been reviewed by anyone qualified**, and say so
  until they have been. Never describe them as compliant.
- **The privacy notice changes in the same pull request as the data map.** Two documents describing
  one practice, updated separately, describe two practices.
