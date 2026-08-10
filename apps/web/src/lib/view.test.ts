import {describe, expect, it} from 'vitest';
import {loadCatalogue} from '@/data/catalogue';
import {FakeChallengeStore} from '@/db/store.fake';
import {drawFrom} from '@/domain/challenge';
import type {Rng} from '@/domain/types';
import {viewChallenge} from './view';

/**
 * The claim this file rests on is that a stored challenge is language-blind.
 *
 * It matters beyond tidiness: the service builds its catalogue from the
 * default locale because ids are all it needs, while each page loads its own
 * locale's. If the state carried anything language-shaped, a Japanese page
 * would render something the English one did not agree with.
 */

const first: Rng = () => 0;

describe('viewing a stored challenge', () => {
  it('renders the same challenge in any locale, differing only in names', async () => {
    const en = await loadCatalogue('en');
    const ja = await loadCatalogue('ja');

    // A challenge stored once, exactly as a page would find it.
    const store = new FakeChallengeStore(en);
    const {publicId} = await store.create({
      handle: '@ika_no_9',
      at: '2026-08-10T12:00:00.000Z',
      draw: drawFrom(en, [], {head: [], clothes: [], shoes: []}, first)
    });
    const stored = await store.findByPublicId(publicId);

    const english = viewChallenge(stored!.state, en, stored!.handle);
    const japanese = viewChallenge(stored!.state, ja, stored!.handle);

    // Same challenge: same ids, same counts, same standing.
    expect(japanese.armory.map((w) => w.id)).toEqual(
      english.armory.map((w) => w.id)
    );
    expect(japanese.armory.map((w) => w.state)).toEqual(
      english.armory.map((w) => w.state)
    );
    expect(japanese.progress).toEqual(english.progress);
    expect(japanese.draw.weapon.id).toBe(english.draw.weapon.id);

    // Different words.
    expect(japanese.draw.weapon.name).not.toBe(english.draw.weapon.name);
  });

  it('reports at least day one, even before a day has passed', async () => {
    const en = await loadCatalogue('en');
    const store = new FakeChallengeStore(en);
    const {publicId} = await store.create({
      handle: '@a',
      at: '2026-08-10T12:00:00.000Z',
      draw: drawFrom(en, [], {head: [], clothes: [], shoes: []}, first)
    });
    const stored = await store.findByPublicId(publicId);

    // A challenge opened a moment ago is on its first day, not its zeroth.
    expect(viewChallenge(stored!.state, en, '@a').day).toBe(1);
  });
});
