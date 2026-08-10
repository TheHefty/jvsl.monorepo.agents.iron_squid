import 'server-only';

import {notFound} from 'next/navigation';
import {cache} from 'react';
import {loadCatalogue} from '@/data/catalogue';
import {challengeService} from '@/service/container';
import type {Locale} from '@/i18n/routing';
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

export const publicChallenge = cache(
  async (publicId: string, locale: Locale): Promise<ChallengeView> => {
    const service = await challengeService();
    const found = await service.read(publicId);
    if (!found) notFound();

    return viewChallenge(
      found.state,
      await loadCatalogue(locale),
      found.handle
    );
  }
);

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
