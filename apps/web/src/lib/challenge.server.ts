import 'server-only';

import {cacheLife, cacheTag} from 'next/cache';
import {notFound} from 'next/navigation';
import {cache} from 'react';
import {loadCatalogue} from '@/data/catalogue';
import {challengeService} from '@/service/container';
import type {Locale} from '@/i18n/routing';
import {challengeTag} from './tags';
import {viewChallenge, type ChallengeView} from './view';

/**
 * What a page calls to get a stored challenge, ready to render.
 *
 * Wrapped in `cache` because a page reads it twice — once in
 * `generateMetadata` and once in the body — and without this that is two round
 * trips to a database whose free tier is metered in compute hours.
 *
 * A challenge that is not there is a 404 rather than an error. For the edit
 * link that is deliberate: a wrong secret and a challenge that never existed
 * produce exactly the same page, so nothing here confirms that an id is real
 * to someone guessing at them.
 */

/**
 * The public page's read, cached.
 *
 * This is the one that needed it. The state is rebuilt by replaying a
 * challenge's whole history on every read, and this is the page people paste
 * into Discord — so without a cache, one shared link turns every visitor into
 * a replay and a database round trip, against a free tier that suspends
 * compute for the rest of the month when its hours run out.
 *
 * Invalidated by tag when a match is reported, so it is not a staleness window
 * anyone waits out. The hours are a safety net for the case where that
 * invalidation never arrives.
 */
async function storedChallenge(publicId: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(challengeTag(publicId));

  const service = await challengeService();
  return service.read(publicId);
}

export const publicChallenge = cache(
  async (publicId: string, locale: Locale): Promise<ChallengeView> => {
    const found = await storedChallenge(publicId);
    if (!found) notFound();

    return viewChallenge(
      found.state,
      await loadCatalogue(locale),
      found.handle
    );
  }
);

/**
 * The editing side is deliberately *not* cached.
 *
 * A player who has just reported a match has to see the result of it, and the
 * only invalidation available to a route handler is stale-while-revalidate —
 * `updateTag`, which expires immediately, is limited to Server Actions, and
 * the write is a route handler on purpose so the rate-limit rule can reach it.
 * One player's own page is not what threatens the compute budget anyway.
 */
export const editableChallenge = cache(
  async (editSecret: string, locale: Locale): Promise<ChallengeView> => {
    const service = await challengeService();
    const found = await service.readByEditSecret(editSecret);
    if (!found) notFound();

    return viewChallenge(
      found.state,
      await loadCatalogue(locale),
      found.handle
    );
  }
);
