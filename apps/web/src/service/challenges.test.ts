import {beforeEach, describe, expect, it} from 'vitest';
import {loadCatalogue} from '@/data/catalogue';
import {FakeChallengeStore} from '@/db/store.fake';
import {WINS_PER_EXTRA_LIFE} from '@/domain/challenge';
import type {Catalogue, Rng} from '@/domain/types';
import {
  ChallengeCompleteError,
  ChallengeService,
  NoSuchChallengeError
} from './challenges';

/**
 * The service against the in-memory store.
 *
 * What is asserted here is the joining — that a reported result reaches the
 * store as the right rows. The rules themselves are covered in
 * domain/challenge.test.ts and are not re-asserted through a store.
 */

const first: Rng = () => 0;

/** A clock that advances a minute per call, so ordering is observable. */
function ticking(from = '2026-08-10T12:00:00.000Z') {
  let tick = 0;
  return () => new Date(Date.parse(from) + tick++ * 60_000).toISOString();
}

describe('the challenge service', () => {
  let catalogue: Catalogue;
  let service: ChallengeService;

  beforeEach(async () => {
    catalogue = await loadCatalogue('en');
    service = new ChallengeService(
      new FakeChallengeStore(catalogue),
      catalogue,
      first,
      ticking()
    );
  });

  const win = (secret: string, key: string) =>
    service.report(secret, {
      result: 'win',
      mode: 'splatZones',
      idempotencyKey: key
    });

  const loss = (secret: string, key: string) =>
    service.report(secret, {
      result: 'loss',
      mode: 'rainmaker',
      idempotencyKey: key
    });

  describe('creating', () => {
    it('opens with a draw already dealt and stored', async () => {
      const {publicId} = await service.create('@ika_no_9');
      const found = await service.read(publicId);

      expect(found?.handle).toBe('@ika_no_9');
      expect(found?.state.run.draw.weaponId).toBeTruthy();
      expect(found?.state.run.lives).toBe(1);
    });

    it('deals a different opening to each challenge', async () => {
      // A real CSPRNG, rather than the fixed rng the other cases use, because
      // "every challenge opens on the same weapon" is exactly the bug a fixed
      // one would hide.
      const random: Rng = (max) => Math.floor(Math.random() * max);
      const varied = new ChallengeService(
        new FakeChallengeStore(catalogue),
        catalogue,
        random,
        ticking()
      );

      const openings = new Set<string>();
      for (let i = 0; i < 20; i += 1) {
        const {publicId} = await varied.create('@a');
        const found = await varied.read(publicId);
        openings.add(JSON.stringify(found?.state.run.draw));
      }

      expect(openings.size).toBeGreaterThan(1);
    });
  });

  describe('reporting a win', () => {
    it('clears the weapon that was up and deals the next one', async () => {
      const {publicId, editSecret} = await service.create('@a');
      const before = await service.read(publicId);
      const up = before!.state.run.draw;

      const {applied, challenge} = await win(editSecret, 'k1');

      expect(applied).toBe(true);
      expect(challenge.state.run.cleared).toEqual([up.weaponId]);
      expect(challenge.state.run.draw).not.toEqual(up);

      // And it is in the store, not only in the returned value.
      const reread = await service.read(publicId);
      expect(reread?.state).toEqual(challenge.state);
    });

    it('earns a life on the tenth win', async () => {
      const {editSecret} = await service.create('@a');

      let last;
      for (let i = 0; i < WINS_PER_EXTRA_LIFE; i += 1) {
        last = await win(editSecret, `k${i}`);
      }

      expect(last?.challenge.state.run.wins).toBe(WINS_PER_EXTRA_LIFE);
      expect(last?.challenge.state.run.lives).toBe(2);
    });
  });

  describe('reporting a loss', () => {
    it('keeps the same weapon up while a life remains', async () => {
      const {editSecret} = await service.create('@a');

      // Ten wins, because that is what buys the second life. With one life a
      // loss ends the run, so there is no "life to spare" before then.
      let last;
      for (let i = 0; i < WINS_PER_EXTRA_LIFE; i += 1) {
        last = await win(editSecret, `w${i}`);
      }
      const up = last!.challenge.state.run.draw;
      expect(last!.challenge.state.run.lives).toBe(2);

      const {challenge} = await loss(editSecret, 'k2');

      expect(challenge.state.run.draw).toEqual(up);
      expect(challenge.state.run.lives).toBe(1);
      expect(challenge.state.run.number).toBe(1);
    });

    it('ends the run and opens the next one at zero lives', async () => {
      const {editSecret} = await service.create('@a');
      const {challenge} = await loss(editSecret, 'k1');

      expect(challenge.state.run.number).toBe(2);
      expect(challenge.state.run.lives).toBe(1);
      expect(challenge.state.run.cleared).toEqual([]);
      expect(challenge.state.deadRuns).toHaveLength(1);
    });
  });

  describe('a retried report', () => {
    it('is accepted and changes nothing the second time', async () => {
      const {publicId, editSecret} = await service.create('@a');

      const firstTry = await win(editSecret, 'same');
      const retry = await win(editSecret, 'same');

      expect(firstTry.applied).toBe(true);
      expect(retry.applied).toBe(false);
      expect(retry.challenge.state).toEqual(firstTry.challenge.state);

      const stored = await service.read(publicId);
      expect(stored?.state.run.matches).toHaveLength(1);
    });

    it('is still ignored after the run it targeted has died', async () => {
      const {publicId, editSecret} = await service.create('@a');

      await loss(editSecret, 'fatal');
      const retry = await loss(editSecret, 'fatal');

      expect(retry.applied).toBe(false);

      const stored = await service.read(publicId);
      expect(stored?.state.run.number).toBe(2);
      expect(stored?.state.deadRuns).toHaveLength(1);
    });
  });

  describe('refusing', () => {
    it('rejects a secret that opens nothing, without saying why', async () => {
      await service.create('@a');

      await expect(win('0'.repeat(26), 'k1')).rejects.toBeInstanceOf(
        NoSuchChallengeError
      );
    });

    it('does not accept the public id in place of the secret', async () => {
      const {publicId} = await service.create('@a');

      await expect(win(publicId, 'k1')).rejects.toBeInstanceOf(
        NoSuchChallengeError
      );
    });

    it('refuses a report against a finished challenge', async () => {
      // A tiny catalogue, so the challenge finishes in one win.
      const tiny: Catalogue = {
        weapons: [{id: 'w-0', name: 'Only', className: 'Shooter'}],
        gear: {
          head: [{id: 'h', name: 'h', slot: 'head'}],
          clothes: [{id: 'c', name: 'c', slot: 'clothes'}],
          shoes: [{id: 's', name: 's', slot: 'shoes'}]
        }
      };
      const small = new ChallengeService(
        new FakeChallengeStore(tiny),
        tiny,
        first,
        ticking()
      );

      const {editSecret} = await small.create('@a');
      const done = await small.report(editSecret, {
        result: 'win',
        mode: 'splatZones',
        idempotencyKey: 'k1'
      });

      expect(done.challenge.state.status).toBe('complete');

      await expect(
        small.report(editSecret, {
          result: 'win',
          mode: 'splatZones',
          idempotencyKey: 'k2'
        })
      ).rejects.toBeInstanceOf(ChallengeCompleteError);
    });
  });

  describe('the timestamp', () => {
    it('is the server’s, and a client cannot supply one', async () => {
      const {publicId, editSecret} = await service.create('@a');
      await win(editSecret, 'k1');
      await win(editSecret, 'k2');

      const stored = await service.read(publicId);
      const [one, two] = stored!.state.run.matches;

      expect(Date.parse(two.at)).toBeGreaterThan(Date.parse(one.at));
    });
  });
});
