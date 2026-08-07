# apps/web

The Iron Squid application — the Next.js rewrite of
[`jvsl.web.angular.iron_squid`](https://github.com/TheHefty/jvsl.web.angular.iron_squid), which is
live at [iron-squid.top](https://www.iron-squid.top) and now frozen.

Commands run from the repo root, which forwards here through the npm workspace — see the root
[`README.md`](../../README.md) and [`CLAUDE.md`](../../CLAUDE.md).

## What it is held to

Not decided here. The documents that govern this code live in [`docs/`](../../docs) at the repo
root, and they win when the code disagrees:

- [`docs/CHALLENGE.md`](../../docs/CHALLENGE.md) — the rules of the challenge, and the vocabulary.
  Worth reading before anything else, because _run_ means one attempt, not the whole thing.
- [`docs/RULES.md`](../../docs/RULES.md) — security, privacy, accessibility and development
  non-negotiables. Read before writing code, not at review.
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — why the app is shaped this way, and what is
  still undecided.

## Status

The interface, against mock data. There is no domain logic, no persistence and no API yet — the
win/loss buttons are inert.

## How it is put together

- **Next.js 16, App Router, TypeScript.** Next.js 16 renamed Middleware to **Proxy**, so the locale
  routing lives in `src/proxy.ts`.
- **Five locales** — `en`, `pt-BR`, `es-419`, `es-ES`, `ja` — through `next-intl`, with the locale
  always in the URL. `pt-BR` translates the interface but keeps English weapon and gear names,
  because Splatoon 3 has no Portuguese localisation and an invented name would be worse than none.
- **Two themes**, resolved on the server from a cookie. The public run page exists to be pasted into
  Discord, so it must never paint the wrong theme and then correct itself.
- **Accessibility is a build constraint, not a pass at the end.** WCAG 2.2 AA is required; the
  contrast corrections live in the design tokens, and the values that fail are not exposed as tokens
  at all. On top of the baseline there are four reader-controlled options: reduce motion, high
  contrast, text size, and carrying weapon state by symbol rather than colour alone.

`src/styles/nocturne.css` is the design system — take colour, spacing, radius, shadow and type from
its variables rather than writing literals. `src/styles/app.css` is this product's own composition.
