import {challengeService} from '@/service/container';
import {createChallenge} from '@/service/http';

/**
 * POST /api/challenges — opens one, and returns its two identifiers.
 *
 * Route handlers are not cached by default, and this one must never be: the
 * response carries the edit secret exactly once.
 *
 * Rate limiting is not here, and not missing either: RULES.md#security requires
 * it, and it is enforced at the edge by a Vercel WAF rule so that a flood never
 * reaches this function. docs/ARCHITECTURE.md records the rule's exact shape,
 * because a decision that lives only in a dashboard cannot be reproduced — and
 * it has to be created before the first deployment, not after.
 */
export async function POST(request: Request): Promise<Response> {
  return createChallenge(await challengeService())(request);
}
