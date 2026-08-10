import {loadCatalogue} from '@/data/catalogue';
import {describeChallengeStore} from './store.contract';
import {FakeChallengeStore} from './store.fake';

/**
 * The fake against the shared contract, in the fast suite.
 *
 * The same assertions run against Postgres in store.contract.test.ts, which is
 * what keeps the two from drifting.
 */
describeChallengeStore('the in-memory store', async () => {
  const catalogue = await loadCatalogue('en');
  return {store: new FakeChallengeStore(catalogue), catalogue};
});
