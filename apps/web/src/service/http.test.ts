import {beforeEach, describe, expect, it} from 'vitest';
import {loadCatalogue} from '@/data/catalogue';
import {FakeChallengeStore} from '@/db/store.fake';
import type {Catalogue, Rng} from '@/domain/types';
import {ChallengeService} from './challenges';
import {createChallenge, reportMatch} from './http';

/**
 * RULES.md requires every route handler to be tested for its happy path, its
 * rejected input, and its idempotent replay. All three are here, against the
 * fake store — the store's own behaviour is covered by the contract suite that
 * runs against both implementations.
 */

const first: Rng = () => 0;

function post(payload: unknown): Request {
  return new Request('http://iron-squid.test/api', {
    method: 'POST',
    body: typeof payload === 'string' ? payload : JSON.stringify(payload)
  });
}

describe('the route handlers', () => {
  let catalogue: Catalogue;
  let service: ChallengeService;
  let create: (r: Request) => Promise<Response>;
  let report: (r: Request) => Promise<Response>;

  beforeEach(async () => {
    catalogue = await loadCatalogue('en');
    let tick = 0;
    service = new ChallengeService(
      new FakeChallengeStore(catalogue),
      catalogue,
      first,
      () => new Date(Date.UTC(2026, 7, 10) + tick++ * 60_000).toISOString()
    );
    create = createChallenge(service);
    report = reportMatch(service);
  });

  async function opened() {
    const response = await create(post({handle: '@ika_no_9'}));
    return (await response.json()) as {publicId: string; editSecret: string};
  }

  describe('creating a challenge', () => {
    it('returns 201 with both identifiers', async () => {
      const response = await create(post({handle: '@ika_no_9'}));

      expect(response.status).toBe(201);
      const created = await response.json();
      expect(created.publicId).toMatch(/^[0-9a-z]{10}$/);
      expect(created.editSecret).toHaveLength(26);
    });

    it('never lets the response carrying the secret be stored', async () => {
      const response = await create(post({handle: '@a'}));
      expect(response.headers.get('cache-control')).toBe('no-store');
    });

    it('rejects a missing, empty or oversized handle', async () => {
      for (const payload of [{}, {handle: ''}, {handle: 'x'.repeat(41)}]) {
        const response = await create(post(payload));
        expect(response.status).toBe(400);
        expect((await response.json()).problems[0].field).toBe('handle');
      }
    });

    it('rejects a body that is not a JSON object', async () => {
      for (const payload of ['not json', '[]', '"a string"']) {
        expect((await create(post(payload))).status).toBe(400);
      }
    });
  });

  describe('reporting a match', () => {
    it('records a win and answers with the new state', async () => {
      const {editSecret, publicId} = await opened();

      const response = await report(
        post({
          editSecret,
          result: 'win',
          mode: 'splatZones',
          idempotencyKey: 'k1'
        })
      );

      expect(response.status).toBe(200);
      const outcome = await response.json();
      expect(outcome.applied).toBe(true);
      expect(outcome.publicId).toBe(publicId);
      expect(outcome.state.run.cleared).toHaveLength(1);
    });

    it('answers 200 and applied:false to a replayed key', async () => {
      const {editSecret} = await opened();
      const payload = {
        editSecret,
        result: 'win',
        mode: 'splatZones',
        idempotencyKey: 'same'
      };

      const firstTry = await report(post(payload));
      const retry = await report(post(payload));

      // Not an error: the queue that sent it twice did nothing wrong, and a
      // 4xx would make Background Sync retry it forever.
      expect(firstTry.status).toBe(200);
      expect(retry.status).toBe(200);
      expect((await firstTry.json()).applied).toBe(true);
      expect((await retry.json()).applied).toBe(false);
    });

    it('invalidates the public page, but only when something changed', async () => {
      const invalidated: string[] = [];
      const reportWith = reportMatch(service, (id) => invalidated.push(id));
      const {editSecret, publicId} = await opened();
      const payload = {
        editSecret,
        result: 'win',
        mode: 'splatZones',
        idempotencyKey: 'once'
      };

      await reportWith(post(payload));
      expect(invalidated).toEqual([publicId]);

      // A recognised replay changed nothing, so there is nothing to
      // invalidate — and doing it anyway would throw away a cache entry on
      // every retry a flaky connection makes.
      await reportWith(post(payload));
      expect(invalidated).toEqual([publicId]);
    });

    it('refuses Turf War, because rule 3 does', async () => {
      const {editSecret} = await opened();

      const response = await report(
        post({editSecret, result: 'win', mode: 'turfWar', idempotencyKey: 'k1'})
      );

      expect(response.status).toBe(400);
      expect((await response.json()).problems[0].field).toBe('mode');
    });

    it('refuses an invented result', async () => {
      const {editSecret} = await opened();

      const response = await report(
        post({
          editSecret,
          result: 'draw',
          mode: 'splatZones',
          idempotencyKey: 'k'
        })
      );

      expect(response.status).toBe(400);
      expect((await response.json()).problems[0].field).toBe('result');
    });

    it('names every problem at once rather than the first', async () => {
      const response = await report(post({}));

      expect(response.status).toBe(400);
      const fields = (await response.json()).problems.map(
        (p: {field: string}) => p.field
      );
      expect(fields).toContain('editSecret');
      expect(fields).toContain('idempotencyKey');
      expect(fields).toContain('result');
      expect(fields).toContain('mode');
    });

    it('answers 404 to a secret that opens nothing', async () => {
      await opened();

      const response = await report(
        post({
          editSecret: '0'.repeat(26),
          result: 'win',
          mode: 'splatZones',
          idempotencyKey: 'k1'
        })
      );

      expect(response.status).toBe(404);
      // The body says nothing about whether a challenge exists.
      expect(await response.json()).toEqual({error: 'not-found'});
    });

    it('does not accept a public id in place of the secret', async () => {
      const {publicId} = await opened();

      const response = await report(
        post({
          editSecret: publicId,
          result: 'win',
          mode: 'splatZones',
          idempotencyKey: 'k1'
        })
      );

      expect(response.status).toBe(404);
    });

    it('cannot alter a challenge other than its own', async () => {
      const mine = await opened();
      const theirs = await opened();

      await report(
        post({
          editSecret: mine.editSecret,
          result: 'win',
          mode: 'splatZones',
          idempotencyKey: 'k1'
        })
      );

      const untouched = await service.read(theirs.publicId);
      expect(untouched?.state.run.cleared).toEqual([]);
    });
  });
});
