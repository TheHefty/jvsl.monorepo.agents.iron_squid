import {beforeEach, describe, expect, it} from 'vitest';
import {drawFrom} from '@/domain/challenge';
import type {Catalogue, Draw, Rng} from '@/domain/types';
import type {ChallengeStore} from './store';

/**
 * The assertions every store must pass, written once and run twice.
 *
 * The fake runs them in the fast suite; the Drizzle store runs them against a
 * real Postgres in `npm run test:db`. That is the whole point of the split:
 * RULES.md requires route handlers to be tested for idempotent replay, but
 * idempotency lives in a unique constraint rather than in any handler, so
 * testing it against a fake alone would test the fake.
 *
 * What belongs here is anything the two could disagree about. What does not is
 * anything the domain already covers — the rules are tested in
 * `domain/challenge.test.ts` and are not re-asserted through a database.
 */

export type StoreUnderTest = {
  store: ChallengeStore;
  catalogue: Catalogue;
};

const first: Rng = () => 0;
const AT = '2026-08-09T12:00:00.000Z';

export function describeChallengeStore(
  name: string,
  setUp: () => Promise<StoreUnderTest>
) {
  describe(name, () => {
    let store: ChallengeStore;
    let catalogue: Catalogue;

    /** A draw the catalogue can actually satisfy, for seeding. */
    const opening = (): Draw =>
      drawFrom(catalogue, [], {head: [], clothes: [], shoes: []}, first);

    async function seed(handle = '@ika_no_9') {
      const created = await store.create({handle, at: AT, draw: opening()});
      const found = await store.findByPublicId(created.publicId);
      if (!found) throw new Error('the challenge just created was not found');
      return {...created, found};
    }

    beforeEach(async () => {
      ({store, catalogue} = await setUp());
    });

    describe('creating', () => {
      it('returns a public id and a secret, and they are not the same thing', async () => {
        const {publicId, editSecret} = await seed();
        expect(publicId).not.toBe(editSecret);
        expect(editSecret.length).toBeGreaterThan(publicId.length);
      });

      it('opens with one run, one life, and the draw it was given', async () => {
        const draw = opening();
        const {publicId} = await store.create({
          handle: '@ika_no_9',
          at: AT,
          draw
        });

        const found = await store.findByPublicId(publicId);
        expect(found?.state.run.number).toBe(1);
        expect(found?.state.run.lives).toBe(1);
        expect(found?.state.run.draw).toEqual(draw);
        expect(found?.state.deadRuns).toHaveLength(0);
      });

      it('gives every challenge its own identifiers', async () => {
        const a = await store.create({handle: 'a', at: AT, draw: opening()});
        const b = await store.create({handle: 'b', at: AT, draw: opening()});
        expect(a.publicId).not.toBe(b.publicId);
        expect(a.editSecret).not.toBe(b.editSecret);
      });
    });

    describe('finding', () => {
      it('finds the same challenge by public id and by secret', async () => {
        const {publicId, editSecret} = await seed();
        const byId = await store.findByPublicId(publicId);
        const bySecret = await store.findByEditSecret(editSecret);
        expect(bySecret).toEqual(byId);
      });

      it('returns nothing for an id or a secret it has never seen', async () => {
        await seed();
        expect(await store.findByPublicId('0000000000')).toBeNull();
        expect(await store.findByEditSecret('0'.repeat(26))).toBeNull();
      });

      it('does not accept one challenge’s secret for another', async () => {
        const a = await seed('a');
        await seed('b');
        const found = await store.findByEditSecret(a.editSecret);
        expect(found?.handle).toBe('a');
      });

      it('resolves an id retyped in the wrong case', async () => {
        const {publicId} = await seed();
        const found = await store.findByPublicId(publicId.toUpperCase());
        expect(found?.publicId).toBe(publicId);
      });
    });

    describe('appending a match', () => {
      it('records a win and the draw dealt after it', async () => {
        const {publicId, found} = await seed();
        const won = found.state.run.draw.weaponId;

        const next = drawFrom(
          catalogue,
          [won],
          {
            head: [found.state.run.draw.gear.head],
            clothes: [found.state.run.draw.gear.clothes],
            shoes: [found.state.run.draw.gear.shoes]
          },
          first
        );

        const result = await store.appendMatch(publicId, {
          idempotencyKey: 'k1',
          result: 'win',
          mode: 'splatZones',
          at: AT,
          nextDraw: next
        });

        expect(result.applied).toBe(true);

        const after = await store.findByPublicId(publicId);
        expect(after?.state.run.cleared).toEqual([won]);
        expect(after?.state.run.wins).toBe(1);
        expect(after?.state.run.draw).toEqual(next);
      });

      it('keeps the draw up after a loss with a life to spare', async () => {
        const {publicId, found} = await seed();
        // Two wins first, so the run has more than one life to lose.
        expect(found.state.run.lives).toBe(1);

        await store.appendMatch(publicId, {
          idempotencyKey: 'k1',
          result: 'loss',
          mode: 'rainmaker',
          at: AT,
          startsRun: 2,
          nextDraw: opening()
        });

        const after = await store.findByPublicId(publicId);
        expect(after?.state.run.number).toBe(2);
        expect(after?.state.deadRuns).toHaveLength(1);
      });

      it('ignores a repeated key and writes nothing the second time', async () => {
        const {publicId, found} = await seed();
        const draw = found.state.run.draw;
        const next = drawFrom(
          catalogue,
          [draw.weaponId],
          {
            head: [draw.gear.head],
            clothes: [draw.gear.clothes],
            shoes: [draw.gear.shoes]
          },
          first
        );

        const write = {
          idempotencyKey: 'same',
          result: 'win' as const,
          mode: 'splatZones' as const,
          at: AT,
          nextDraw: next
        };

        expect((await store.appendMatch(publicId, write)).applied).toBe(true);
        expect((await store.appendMatch(publicId, write)).applied).toBe(false);

        const after = await store.findByPublicId(publicId);
        expect(after?.state.run.wins).toBe(1);
        expect(after?.state.run.matches).toHaveLength(1);
      });

      it('still ignores a repeated key after the run it targeted has died', async () => {
        // The reason idempotency is scoped to the challenge and not the run: a
        // client retrying a report knows nothing about a run having ended in
        // between, and the new run has never seen the key.
        const {publicId} = await seed();

        const killing = {
          idempotencyKey: 'fatal',
          result: 'loss' as const,
          mode: 'clamBlitz' as const,
          at: AT,
          startsRun: 2,
          nextDraw: opening()
        };

        expect((await store.appendMatch(publicId, killing)).applied).toBe(true);
        expect((await store.appendMatch(publicId, killing)).applied).toBe(
          false
        );

        const after = await store.findByPublicId(publicId);
        expect(after?.state.run.number).toBe(2);
        expect(after?.state.deadRuns).toHaveLength(1);
      });

      it('accepts a different key as a different match', async () => {
        const {publicId} = await seed();

        await store.appendMatch(publicId, {
          idempotencyKey: 'k1',
          result: 'loss',
          mode: 'rainmaker',
          at: AT,
          startsRun: 2,
          nextDraw: opening()
        });
        await store.appendMatch(publicId, {
          idempotencyKey: 'k2',
          result: 'loss',
          mode: 'towerControl',
          at: AT,
          startsRun: 3,
          nextDraw: opening()
        });

        const after = await store.findByPublicId(publicId);
        expect(after?.state.run.number).toBe(3);
        expect(after?.state.deadRuns).toHaveLength(2);
      });

      it('records the completion, so it can be counted without a replay', async () => {
        const {publicId, editSecret} = await seed();
        const found = await store.findByEditSecret(editSecret);

        await store.appendMatch(publicId, {
          idempotencyKey: 'k1',
          result: 'win',
          mode: 'splatZones',
          at: AT,
          completesAt: AT,
          nextDraw: found!.state.run.draw
        });

        expect((await store.overview()).completed).toBe(1);
      });

      it('rejects a write against a challenge that is not there', async () => {
        await expect(
          store.appendMatch('0000000000', {
            idempotencyKey: 'k1',
            result: 'win',
            mode: 'splatZones',
            at: AT
          })
        ).rejects.toThrow();
      });
    });

    describe('the overview', () => {
      it('is empty on an empty site rather than absent', async () => {
        const overview = await store.overview();
        expect(overview).toEqual({runs: 0, completed: 0, latest: null});
      });

      it('counts every run across every challenge', async () => {
        const a = await seed('a');
        await seed('b');

        // Kill a's first run, so it has two.
        await store.appendMatch(a.publicId, {
          idempotencyKey: 'k1',
          result: 'loss',
          mode: 'rainmaker',
          at: AT,
          startsRun: 2,
          nextDraw: opening()
        });

        expect((await store.overview()).runs).toBe(3);
      });

      it('offers the most recently active challenge, not the newest', async () => {
        const older = await seed('older');
        await seed('newer');

        // A match on the older one makes it the active one again.
        await store.appendMatch(older.publicId, {
          idempotencyKey: 'k1',
          result: 'loss',
          mode: 'rainmaker',
          at: '2027-01-01T00:00:00.000Z',
          startsRun: 2,
          nextDraw: opening()
        });

        const overview = await store.overview();
        expect(overview.latest?.handle).toBe('older');
      });
    });
  });
}
