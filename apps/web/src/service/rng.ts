import 'server-only';

import {randomInt} from 'node:crypto';
import type {Rng} from '@/domain/types';

/**
 * The randomness the server owns.
 *
 * `randomInt` draws from the same CSPRNG as `randomBytes` and rejects out-of-
 * range samples internally, so it is uniform over [0, max) rather than a
 * modulo of something wider.
 *
 * This is the only `Rng` production ever uses. RULES.md#security explains why
 * it lives here and not in the browser: a client that can re-roll until it
 * likes the weapon voids rules 1 and 3 invisibly, and no amount of honour
 * system covers that.
 */
export const serverRng: Rng = (exclusiveMax) => randomInt(exclusiveMax);
