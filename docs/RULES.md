# Rules

Non-negotiables for working on Iron Squid: security, privacy, and how code gets written here. These
are constraints, not suggestions — a change that breaks one of them does not ship, and if a rule is
wrong it gets changed here first, deliberately, rather than worked around in a PR.

For the rules of the *challenge* — draws, lives, resets — see [CHALLENGE.md](CHALLENGE.md).

## Security

**The server owns the randomness.** Draws are generated server-side with a CSPRNG and persisted
before they are shown to anyone. The client never generates a draw, never re-rolls, and is never
sent the remaining pool. This is the one rule the honour system cannot cover: self-reported results
are visible and socially checkable, but a client that can re-roll until it likes the weapon voids
the challenge invisibly. The Angular app shipped an unrestricted `rerollGear` handler; it is not
coming back.

**The secret edit link is a credential.** It grants full write access to a challenge with no second
factor, so it is treated like a password:

- Generated from a CSPRNG with at least 128 bits of entropy. Never sequential, never derived from
  the challenge id, never guessable from anything on the public page.
- Never logged — not in access logs, not in error reports, not in analytics. Scrub it from any URL
  before it reaches a log line or a third party.
- Never rendered on a public page, never embedded in `<meta>` or link-preview content, and never
  present in the DOM of a page served under a public URL.
- Editor pages send `Referrer-Policy: no-referrer`, because the token lives in the URL and any
  outbound link would otherwise hand it to the destination site.
- Looked up by hash, not stored in plaintext, so a database leak does not hand over every run.
- **Never cached by the service worker.** Only public routes and the app shell are cacheable. A
  Cache Storage entry outlives the tab and sits on a device that may be shared, so caching an edit
  route writes the credential to disk on someone's phone.

**Everything from a client is untrusted.** Route handlers validate their input against a schema at
the boundary and work from the parsed result, never from the raw body. A reported match result may
be a lie — that is accepted by design — but it must still be a *well-formed* lie that cannot alter
anything but its own challenge.

**Challenge creation is rate-limited.** It is unauthenticated and public, which makes it a spam and
storage-exhaustion vector.

**No secrets in the client bundle.** Anything in a `NEXT_PUBLIC_` variable or shipped to the browser
is public; database URLs, API keys and signing secrets stay server-side. Never commit a real secret,
including in a test fixture or an example env file.

## Privacy

**Collect nothing that is not needed.** No accounts means no emails, no passwords, no password
resets, and close to no personal data — that is a feature, and it keeps our obligations under LGPD
and GDPR proportionally small. Do not add a field, a cookie, or an analytics script that
re-introduces personal data without a decision recorded in
[ARCHITECTURE.md](ARCHITECTURE.md).

**Public means public, and it must be obvious.** A challenge's public page is the product, but the
player has to know that before they type anything. Everything on that page is content the player
entered themselves; nothing is inferred, enriched, or cross-referenced with another service.

**The player can delete their challenge.** Holding the secret link means being able to destroy the
data it points at, permanently, without asking anyone.

**Handles are user content.** A player-chosen display name is untrusted text: escape it everywhere,
never interpolate it into HTML, and expect that some of them will need removing.

## Accessibility

**WCAG 2.2 AA is the floor, not the goal.** A change that drops below it does not ship, the same way
a change that leaks a token does not ship.

**Contrast is checked in both themes.** Dark and light are separate palettes with separate failures
— the light accent #796cbf measures 4.10:1 and cannot carry body text, while its dark counterpart at
5.45:1 can. Passing in one theme proves nothing about the other. Text needs 4.5:1 (3:1 at large
sizes); anything that conveys state needs 3:1 against what surrounds it.

**Colour is never the only channel.** Every state that matters — cleared, current, untouched, win,
loss — is also carried by shape, position or text. The armory grid is the product's central display
and the place this is easiest to get wrong.

**Everything interactive is reachable by keyboard and visibly focused.** Nocturne's 2px
`:focus-visible` ring is the house style; never suppress it without replacing it.

**A `title` attribute is not an accessible name.** Neither is a bare `<div>`. Anything conveying
information gets real semantics and a real name — including the 162 weapon tiles.

**Motion respects `prefers-reduced-motion`**, and the in-site reduce-motion toggle overrides it in
either direction.

## Development

**Domain logic is framework-free.** The rules of the challenge live in their own module with no
React, no framework imports and no I/O — pure functions over plain data. They are not allowed into
components. The Angular app put the entire draw/lives/reset engine inside a presentational card
component, which made it untestable and impossible to enforce server-side; that is precisely the
mistake being corrected.

**Writes that the offline queue can reach are idempotent.** Every one takes a client-generated
idempotency key and ignores a repeat. Background Sync retries, tabs get restored, and requests
arrive twice; without this, one bad connection silently spends a life or clears a weapon twice.

**Every bug fix ships with a regression test** for the exact scenario that was broken — not a test
of the general area, the specific case. If the code cannot be tested as written, refactor it until
it can, in the same change.

**Game data is data.** Weapon counts, gear counts, mode lists and anything else the game decides are
read from the dataset at runtime. No magic numbers: the previous implementation hardcoded `129` and
went stale on its own the next time Splatoon 3 shipped weapons.

**No user-facing string is written in a component.** Every word a player can read goes through the
message catalogue for its locale, and every weapon or gear name comes from the dataset for that
locale — never a literal, never a hand-built plural, never a date or number assembled with string
concatenation instead of `Intl`. A locale that has no official name for something falls back to
English on purpose (`pt-BR`); it never falls back to an invented translation.

**Style comes from the design tokens.** Nocturne's `styles.css` is the source of truth for colour,
spacing, radius, shadow and type. Never hardcode a hex, a font name or a px value the tokens already
carry, and build with the system's own classes rather than parallel ones.

**Commit messages are load-bearing.** Conventional commits drive release-please: only `feat` and
`fix` reach the changelog, and only they propose a release. A behaviour change committed as `chore`
is a release that never happens.

**`master` is protected — everything goes through a PR**, including one-line doc fixes and submodule
bumps. No approvals are required, so this costs a branch and a merge, not a review cycle.

**Generated files are never hand-edited.** `.code-server/Dockerfile` is composed by
`.code-server/setup` and regenerated from scratch every build.

**Submodule bumps pin to a tag, not a bare commit.** A commit from a branch that is later
squash-merged becomes unreachable, and every fresh clone then fails `git submodule update`.
