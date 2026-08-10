import {loadCatalogue} from '@/data/catalogue';
import {applyMatch, drawsFrom, startChallenge} from '@/domain/challenge';
import {
  MATCH_MODES,
  type Catalogue,
  type ChallengeState,
  type MatchMode,
  type MatchResult,
  type Rng
} from '@/domain/types';
import type {Locale} from '@/i18n/routing';
import {viewChallenge} from './view';

/**
 * A worked example of a challenge in progress, for the screens to render until
 * there is somewhere to persist a real one.
 *
 * It is not mock data. Nothing here invents a number: the challenge is *played*
 * — a fixed script of wins and losses pushed through `applyMatch` against the
 * real catalogue — and every figure the pages show is then derived from the
 * resulting state. So the lives, the cleared count, the gear ledger and the log
 * cannot contradict each other, which hand-written fixtures reliably do the
 * moment one of them is edited.
 *
 * When persistence lands, this is the seam that gets replaced: the pages ask
 * for a challenge and render it, and they will not care that it started coming
 * from a database.
 */

/**
 * mulberry32, seeded, so the demo is identical on every render and on every
 * machine.
 *
 * This is emphatically not what production draws with — rule 1 needs a CSPRNG
 * on the server, and `Rng` is a parameter precisely so the two can differ
 * without the rules knowing.
 */
function seeded(seed: number): Rng {
  let a = seed >>> 0;

  return (exclusiveMax) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * exclusiveMax);
  };
}

const SEED = 20260515;

/** Wall clock. Fixed, so a render today and a render tomorrow agree. */
const FIRST_MATCH = Date.parse('2026-05-15T18:00:00.000Z');
const HOURS_BETWEEN_MATCHES = 7;

/**
 * How far each of the six dead runs got before it ran out of lives.
 *
 * The 62 is the one that matters: it is the personal best the live run is
 * chasing, and it is a real number here rather than a caption — the run really
 * did clear 62 weapons before it died.
 */
const DEAD_RUN_WINS = [3, 11, 7, 62, 15, 31];

/** The live run: 40 cleared, with two lives spent along the way. */
const LIVE_RUN_WINS = 40;
const LOSSES_AFTER_WIN = [20, 34];

/** Site-wide counters. Genuinely not derivable — they need every player's data. */
export const SITE_TOTALS = {runs: 1204, completed: 0};

/** The display name. Unverified by design; see CHALLENGE.md on identity. */
export const DEMO_HANDLE = '@ika_no_9';

function play(catalogue: Catalogue): ChallengeState {
  const rng = seeded(SEED);
  let tick = 0;

  const at = () =>
    new Date(
      FIRST_MATCH + tick++ * HOURS_BETWEEN_MATCHES * 3_600_000
    ).toISOString();

  const mode = (): MatchMode => MATCH_MODES[rng(MATCH_MODES.length)];

  const draws = drawsFrom(catalogue, rng);
  let state = startChallenge(draws, at());

  const report = (result: MatchResult) => {
    state = applyMatch(state, catalogue, draws, {
      result,
      mode: mode(),
      at: at()
    });
  };

  for (const wins of DEAD_RUN_WINS) {
    for (let i = 0; i < wins; i += 1) report('win');

    // Lose until the run actually ends. A run past ten wins has earned extra
    // lives, so how many losses that takes is not a number to hardcode.
    const dying = state.run.number;
    while (state.run.number === dying) report('loss');
  }

  for (let win = 1; win <= LIVE_RUN_WINS; win += 1) {
    report('win');
    if (LOSSES_AFTER_WIN.includes(win)) report('loss');
  }

  return state;
}

export type DemoChallenge = ReturnType<typeof view>;

/**
 * The demo is now the landing page's source and nothing else's — every other
 * screen reads a stored challenge. It survives because the landing shows a
 * live roll card and site-wide totals, and neither has a real answer while no
 * challenge exists and the store has no operation that counts them.
 */
function view(catalogue: Catalogue) {
  return {
    ...viewChallenge(play(catalogue), catalogue, DEMO_HANDLE),
    site: SITE_TOTALS
  };
}

/**
 * Built once per locale. The state is identical across all of them — ids are
 * language-blind and the seed is fixed — so only the names differ.
 */
const cache = new Map<Locale, Promise<DemoChallenge>>();

export function getDemoChallenge(locale: Locale): Promise<DemoChallenge> {
  let built = cache.get(locale);
  if (!built) {
    built = loadCatalogue(locale).then(view);
    cache.set(locale, built);
  }
  return built;
}
