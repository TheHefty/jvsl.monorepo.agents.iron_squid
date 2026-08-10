import {challengeService} from '@/service/container';
import {createChallenge} from '@/service/http';

/**
 * POST /api/challenges — opens one, and returns its two identifiers.
 *
 * Route handlers are not cached by default, and this one must never be: the
 * response carries the edit secret exactly once.
 *
 * NOT YET RATE-LIMITED. RULES.md#security requires it — creation is
 * unauthenticated and public, which makes it a spam and storage-exhaustion
 * vector — and nothing here provides it. See docs/CURRENT_STATE.md.
 */
export async function POST(request: Request): Promise<Response> {
  return createChallenge(await challengeService())(request);
}
