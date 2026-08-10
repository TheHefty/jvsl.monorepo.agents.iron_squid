import {revalidateTag} from 'next/cache';
import {challengeTag} from '@/lib/tags';
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
  // The public page caches a challenge under this tag; a reported match is the
  // only thing that changes it. `revalidateTag` is stale-while-revalidate,
  // which is why the player's own editing page is not cached at all — they
  // need to see their own write, and `updateTag` is Server Actions only.
  const revalidate = (publicId: string) => {
    revalidateTag(challengeTag(publicId), 'max');
  };

  return reportMatch(await challengeService(), revalidate)(request);
}
