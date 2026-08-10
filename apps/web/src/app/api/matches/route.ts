import {challengeService} from '@/service/container';
import {reportMatch} from '@/service/http';

/**
 * POST /api/matches — records a reported result.
 *
 * The edit secret arrives in the body, not the path: it is a credential, and a
 * URL path reaches the access log of every hop between here and the client,
 * which RULES.md#security forbids.
 */
export async function POST(request: Request): Promise<Response> {
  return reportMatch(await challengeService())(request);
}
