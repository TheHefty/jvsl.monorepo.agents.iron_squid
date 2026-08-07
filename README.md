# Iron Squid

A public tracker for a Splatoon 3 gauntlet: the weapon and the gear set are drawn at random, you
have to win with the one you were given before you get another, and you have to do it with every
weapon in the game. One loss too many and the whole armory goes back on the table.

The rules in full are in [`docs/CHALLENGE.md`](docs/CHALLENGE.md).

## Status

Being rebuilt. The version currently live at [iron-squid.top](https://www.iron-squid.top) is an
Angular app that keeps everything in the browser it was played in — see
[`jvsl.web.angular.iron_squid`](https://github.com/TheHefty/jvsl.web.angular.iron_squid), which is
now frozen and kept as a reference.

This repo is where it becomes a public tracker: challenges that live on a server, run pages you can
share, and a record of every run that died along the way. **No application code has landed yet** —
what is here is the dev container, the release plumbing and the design docs.

## Docs

- [`docs/CHALLENGE.md`](docs/CHALLENGE.md) — the challenge, stated canonically. The source of truth
  for behaviour, including the questions still open.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the software is built and why: the decisions
  taken, what was learned from the original app, and what is still undecided.
- [`docs/RULES.md`](docs/RULES.md) — security, privacy and development rules every change is held
  to.
- [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — the dev container: prerequisites, building the image,
  starting the environment.

## Getting started

Clone with `git clone --recurse-submodules`, or run `git submodule update --init` after a plain
clone — `.code-server/` is empty until the submodule is checked out. Then follow
[`docs/OVERVIEW.md`](docs/OVERVIEW.md) to build and start the environment.

## Credits

Built on the [code-server dev-container template](https://github.com/TheHefty/jvsl.env.agents.code-server),
vendored as a submodule at `.code-server/`.

## License

[MIT](LICENSE)
