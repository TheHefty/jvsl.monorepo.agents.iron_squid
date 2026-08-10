import {armoryView, drawView, matchLog, progress} from '@/domain/challenge';
import type {Catalogue, ChallengeState} from '@/domain/types';

/**
 * A stored challenge, as the screens need it.
 *
 * Pure: state and catalogue in, one object out, no I/O and no rules of its own
 * — everything here is a read model the domain already computes. This is the
 * seam persistence was always going to replace. What changed when it arrived
 * was where the *state* comes from, and nothing else, which is why the pages
 * did not have to learn anything new.
 *
 * The state is language-blind — it holds ids — so the same one renders in any
 * locale by passing that locale's catalogue.
 */

export type ChallengeView = ReturnType<typeof viewChallenge>;

export function viewChallenge(
  challenge: ChallengeState,
  catalogue: Catalogue,
  handle: string
) {
  const log = matchLog(challenge, catalogue);

  return {
    catalogue,
    challenge,
    progress: progress(challenge, catalogue),
    armory: armoryView(challenge, catalogue),
    draw: drawView(challenge, catalogue),
    log,
    run: challenge.run,
    /** Days from the start of the live run to its most recent match. */
    day: Math.max(
      1,
      Math.floor(
        (Date.parse(log[0]?.at ?? challenge.run.startedAt) -
          Date.parse(challenge.run.startedAt)) /
          86_400_000
      )
    ),
    handle
  };
}
