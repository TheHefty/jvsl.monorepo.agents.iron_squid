import 'server-only';

import {cache} from 'react';
import {loadCatalogue} from '@/data/catalogue';
import {db} from '@/db/client';
import {DrizzleChallengeStore} from '@/db/store.drizzle';
import {routing} from '@/i18n/routing';
import {ChallengeService} from './challenges';
import {serverRng} from './rng';

/**
 * Where the production service is assembled.
 *
 * This is the only module that knows which store, which generator and which
 * clock are the real ones. Everything above takes them as arguments, which is
 * what lets the handlers be tested without any of this.
 *
 * `cache` de-duplicates the build within a single request, so two handlers or
 * a handler and a page do not each load the catalogue.
 */
export const challengeService = cache(async () => {
  // The catalogue's names are per-locale, but nothing a route handler decides
  // depends on them — ids are what the domain and the store move around. The
  // default locale is used so there is one instance rather than five.
  const catalogue = await loadCatalogue(routing.defaultLocale);

  return new ChallengeService(
    new DrizzleChallengeStore(db(), catalogue),
    catalogue,
    serverRng,
    () => new Date().toISOString()
  );
});
