import {describe, expect, it} from 'vitest';
import {
  LIVES_AT_START,
  WINS_PER_EXTRA_LIFE,
  applyMatch,
  drawFrom,
  progress,
  startChallenge,
  targetWeaponCount
} from './challenge';
import {
  EmptyPoolError,
  type Catalogue,
  type ChallengeState,
  type Rng
} from './types';

/**
 * Every rule in docs/CHALLENGE.md has a test here that fails if the rule is
 * broken, and the boundaries are covered explicitly: the tenth win, the last
 * life, and the last weapon.
 */

function catalogue(weapons = 5, gearPerSlot = 40): Catalogue {
  const item =
    (slot: 'head' | 'clothes' | 'shoes') => (_: unknown, i: number) => ({
      id: `${slot}-${i}`,
      name: `${slot} ${i}`,
      slot
    });

  return {
    weapons: Array.from({length: weapons}, (_, i) => ({
      id: `w-${i}`,
      name: `Weapon ${i}`,
      className: 'Shooter'
    })),
    gear: {
      head: Array.from({length: gearPerSlot}, item('head')),
      clothes: Array.from({length: gearPerSlot}, item('clothes')),
      shoes: Array.from({length: gearPerSlot}, item('shoes'))
    }
  };
}

/** Always takes the first available option, so draws are predictable. */
const firstAlways: Rng = () => 0;

/** Replays a fixed sequence of indices, cycling. Order: weapon, head, clothes, shoes. */
function scripted(...indices: number[]): Rng {
  let i = 0;
  return () => indices[i++ % indices.length];
}

const AT = '2026-08-07T12:00:00.000Z';

function win(
  state: ChallengeState,
  cat: Catalogue,
  rng: Rng = firstAlways,
  at = AT
) {
  return applyMatch(state, cat, rng, {result: 'win', at});
}

function loss(
  state: ChallengeState,
  cat: Catalogue,
  rng: Rng = firstAlways,
  at = AT
) {
  return applyMatch(state, cat, rng, {result: 'loss', at});
}

describe('starting a challenge', () => {
  it('opens with one life, no wins, and a draw already dealt', () => {
    const cat = catalogue();
    const state = startChallenge(cat, firstAlways, AT);

    expect(state.status).toBe('ongoing');
    expect(state.run.number).toBe(1);
    expect(state.run.lives).toBe(LIVES_AT_START);
    expect(state.run.wins).toBe(0);
    expect(state.run.cleared).toEqual([]);
    expect(state.run.draw.weaponId).toBe('w-0');
    expect(state.deadRuns).toEqual([]);
  });

  it('derives the target from the catalogue rather than a constant', () => {
    expect(targetWeaponCount(catalogue(7))).toBe(7);
    expect(targetWeaponCount(catalogue(162))).toBe(162);
  });
});

describe('the draw', () => {
  it('never offers a weapon already cleared in this run', () => {
    const cat = catalogue(3);
    const draw = drawFrom(
      cat,
      ['w-0', 'w-1'],
      {head: [], clothes: [], shoes: []},
      firstAlways
    );
    expect(draw.weaponId).toBe('w-2');
  });

  it('never offers a gear item already spent, per slot', () => {
    const cat = catalogue(3, 3);
    const draw = drawFrom(
      cat,
      [],
      {head: ['head-0'], clothes: ['clothes-0', 'clothes-1'], shoes: []},
      firstAlways
    );

    expect(draw.gear.head).toBe('head-1');
    expect(draw.gear.clothes).toBe('clothes-2');
    expect(draw.gear.shoes).toBe('shoes-0');
  });

  it('spends a slot independently of the others', () => {
    // Single use is per item, not per set: spending a head does not restrict
    // which clothes or shoes may be drawn.
    const cat = catalogue(3, 2);
    const draw = drawFrom(
      cat,
      [],
      {head: ['head-0'], clothes: [], shoes: []},
      firstAlways
    );
    expect(draw.gear.clothes).toBe('clothes-0');
    expect(draw.gear.shoes).toBe('shoes-0');
  });

  it('reads the rng as weapon, head, clothes, shoes in that order', () => {
    const cat = catalogue(4, 4);
    const draw = drawFrom(
      cat,
      [],
      {head: [], clothes: [], shoes: []},
      scripted(3, 2, 1, 0)
    );

    expect(draw).toEqual({
      weaponId: 'w-3',
      gear: {head: 'head-2', clothes: 'clothes-1', shoes: 'shoes-0'}
    });
  });

  it('refuses to draw from an empty weapon pool', () => {
    const cat = catalogue(2);
    expect(() =>
      drawFrom(
        cat,
        ['w-0', 'w-1'],
        {head: [], clothes: [], shoes: []},
        firstAlways
      )
    ).toThrow(EmptyPoolError);
  });

  it('refuses to draw from an exhausted gear slot', () => {
    const cat = catalogue(3, 1);
    expect(() =>
      drawFrom(cat, [], {head: ['head-0'], clothes: [], shoes: []}, firstAlways)
    ).toThrow(EmptyPoolError);
  });

  it('rejects an rng that returns an index outside the pool', () => {
    // A silently corrupt draw is worse than a crash: it would hand the player
    // a weapon that is not in the pool, or undefined.
    const cat = catalogue(3);
    expect(() =>
      drawFrom(cat, [], {head: [], clothes: [], shoes: []}, () => 99)
    ).toThrow(RangeError);
    expect(() =>
      drawFrom(cat, [], {head: [], clothes: [], shoes: []}, () => -1)
    ).toThrow(RangeError);
    expect(() =>
      drawFrom(cat, [], {head: [], clothes: [], shoes: []}, () => 1.5)
    ).toThrow(RangeError);
  });

  it('only produces a new draw as the result of a reported match', () => {
    // Rule 1 — no re-rolling — is enforced by absence rather than by a check:
    // `applyMatch` is the only path to a new draw, and it needs a result.
    const cat = catalogue(5);
    const state = startChallenge(cat, firstAlways, AT);
    const before = state.run.draw;

    expect(win(state, cat).run.draw).not.toEqual(before);
    expect(loss(state, cat).run.draw).toEqual(before);
  });
});

describe('winning', () => {
  it('clears the weapon, spends the gear, and deals a new draw', () => {
    const cat = catalogue(5);
    const start = startChallenge(cat, firstAlways, AT);
    const drawn = start.run.draw;
    const next = win(start, cat);

    expect(next.run.cleared).toEqual([drawn.weaponId]);
    expect(next.run.wins).toBe(1);
    expect(next.run.spentGear.head).toEqual([drawn.gear.head]);
    expect(next.run.spentGear.clothes).toEqual([drawn.gear.clothes]);
    expect(next.run.spentGear.shoes).toEqual([drawn.gear.shoes]);
    expect(next.run.draw.weaponId).not.toBe(drawn.weaponId);
  });

  it('never deals a cleared weapon again within the run', () => {
    const cat = catalogue(4);
    let state = startChallenge(cat, firstAlways, AT);
    const seen: string[] = [];

    for (let i = 0; i < 4; i++) {
      seen.push(state.run.draw.weaponId);
      state = win(state, cat);
    }

    expect(new Set(seen).size).toBe(4);
  });

  it('records the win', () => {
    const cat = catalogue();
    const state = win(startChallenge(cat, firstAlways, AT), cat);

    expect(state.run.matches).toHaveLength(1);
    expect(state.run.matches[0]).toMatchObject({result: 'win', at: AT});
  });
});

describe('lives', () => {
  it('grants one on the tenth win and not before', () => {
    const cat = catalogue(30);
    let state = startChallenge(cat, firstAlways, AT);

    for (let i = 1; i <= WINS_PER_EXTRA_LIFE - 1; i++) {
      state = win(state, cat);
      expect(state.run.lives).toBe(LIVES_AT_START);
    }

    state = win(state, cat);
    expect(state.run.wins).toBe(10);
    expect(state.run.lives).toBe(LIVES_AT_START + 1);
  });

  it('does not grant another on the eleventh, and does on the twentieth', () => {
    const cat = catalogue(30);
    let state = startChallenge(cat, firstAlways, AT);
    for (let i = 0; i < 11; i++) state = win(state, cat);
    expect(state.run.lives).toBe(2);

    for (let i = 0; i < 9; i++) state = win(state, cat);
    expect(state.run.wins).toBe(20);
    expect(state.run.lives).toBe(3);
  });

  it('counts wins toward the next life from the run, not the challenge', () => {
    const cat = catalogue(30);
    let state = startChallenge(cat, firstAlways, AT);
    for (let i = 0; i < 5; i++) state = win(state, cat);

    state = loss(state, cat); // one life, so this ends the run
    expect(state.run.wins).toBe(0);
    expect(progress(state, cat).winsToNextLife).toBe(WINS_PER_EXTRA_LIFE);
  });
});

describe('losing', () => {
  it('spends a life and keeps the same draw', () => {
    // The weapon you were given stays yours until you win with it.
    const cat = catalogue(30);
    let state = startChallenge(cat, firstAlways, AT);
    for (let i = 0; i < 10; i++) state = win(state, cat);

    const drawBefore = state.run.draw;
    state = loss(state, cat);

    expect(state.run.lives).toBe(1);
    expect(state.run.draw).toEqual(drawBefore);
    expect(state.run.cleared).toHaveLength(10);
  });

  it('records the loss, including one that does not end the run', () => {
    // The previous implementation only wrote a defeat to history when it was
    // the last life, so intermediate losses vanished from the run log.
    const cat = catalogue(30);
    let state = startChallenge(cat, firstAlways, AT);
    for (let i = 0; i < 10; i++) state = win(state, cat);
    state = loss(state, cat);

    const losses = state.run.matches.filter((m) => m.result === 'loss');
    expect(losses).toHaveLength(1);
    expect(state.run.lives).toBeGreaterThan(0);
  });
});

describe('the reset', () => {
  it('ends the run at zero lives and starts the next from nothing', () => {
    const cat = catalogue(5);
    let state = startChallenge(cat, firstAlways, AT);
    state = win(state, cat);
    state = win(state, cat);

    const endedAt = '2026-08-07T13:00:00.000Z';
    state = loss(state, cat, firstAlways, endedAt);

    expect(state.run.number).toBe(2);
    expect(state.run.lives).toBe(LIVES_AT_START);
    expect(state.run.wins).toBe(0);
    expect(state.run.cleared).toEqual([]);
    expect(state.run.matches).toEqual([]);
    expect(state.run.spentGear).toEqual({head: [], clothes: [], shoes: []});
    expect(state.status).toBe('ongoing');
  });

  it('restores every weapon, including ones already cleared', () => {
    const cat = catalogue(3);
    let state = startChallenge(cat, firstAlways, AT);
    state = win(state, cat); // clears w-0
    expect(state.run.draw.weaponId).toBe('w-1');

    state = loss(state, cat);
    expect(state.run.draw.weaponId).toBe('w-0');
  });

  it('restores the gear pools too', () => {
    const cat = catalogue(3);
    let state = startChallenge(cat, firstAlways, AT);
    const firstGear = state.run.draw.gear;
    state = win(state, cat);
    expect(state.run.draw.gear.head).not.toBe(firstGear.head);

    state = loss(state, cat);
    expect(state.run.draw.gear).toEqual(firstGear);
  });

  it('keeps the dead run, with its matches, as history', () => {
    const cat = catalogue(5);
    let state = startChallenge(cat, firstAlways, AT);
    state = win(state, cat);
    state = loss(state, cat, firstAlways, '2026-08-07T13:00:00.000Z');

    expect(state.deadRuns).toHaveLength(1);
    expect(state.deadRuns[0]).toMatchObject({
      number: 1,
      cleared: ['w-0'],
      startedAt: AT,
      endedAt: '2026-08-07T13:00:00.000Z'
    });
    expect(state.deadRuns[0].matches).toHaveLength(2);
  });

  it('puts the newest dead run first', () => {
    const cat = catalogue(5);
    let state = startChallenge(cat, firstAlways, AT);
    state = loss(state, cat);
    state = loss(state, cat);

    expect(state.deadRuns.map((r) => r.number)).toEqual([2, 1]);
    expect(state.run.number).toBe(3);
  });
});

describe('the end', () => {
  it('completes when a single run clears the last weapon', () => {
    const cat = catalogue(3);
    let state = startChallenge(cat, firstAlways, AT);
    state = win(state, cat);
    state = win(state, cat);
    expect(state.status).toBe('ongoing');

    const finishedAt = '2026-08-07T14:00:00.000Z';
    state = win(state, cat, firstAlways, finishedAt);

    expect(state.status).toBe('complete');
    expect(state.completedAt).toBe(finishedAt);
    expect(state.run.cleared).toHaveLength(3);
  });

  it('does not try to deal a draw it cannot satisfy on the last win', () => {
    const cat = catalogue(2);
    let state = startChallenge(cat, firstAlways, AT);
    state = win(state, cat);
    expect(() => win(state, cat)).not.toThrow();
  });

  it('refuses further matches once complete', () => {
    const cat = catalogue(1);
    const state = win(startChallenge(cat, firstAlways, AT), cat);
    expect(state.status).toBe('complete');
    expect(() => win(state, cat)).toThrow(/complete/i);
  });

  it('needs the weapons cleared in one run, not across several', () => {
    // Two weapons cleared in run 1 and one in run 2 is not a finished
    // challenge — that is the whole point of the reset.
    const cat = catalogue(3);
    let state = startChallenge(cat, firstAlways, AT);
    state = win(state, cat);
    state = win(state, cat);
    state = loss(state, cat);
    state = win(state, cat);

    expect(state.status).toBe('ongoing');
    expect(state.run.cleared).toHaveLength(1);
  });
});

describe('purity', () => {
  it('does not mutate the state it is given', () => {
    const cat = catalogue(5);
    const state = startChallenge(cat, firstAlways, AT);
    const snapshot = structuredClone(state);

    win(state, cat);
    loss(state, cat);

    expect(state).toEqual(snapshot);
  });

  it('does not mutate the catalogue', () => {
    const cat = catalogue(5);
    const snapshot = structuredClone(cat);
    const played = loss(win(startChallenge(cat, firstAlways, AT), cat), cat);

    expect(played.run.number).toBe(2);
    expect(cat).toEqual(snapshot);
  });
});

describe('progress', () => {
  it('reports what the interface needs, derived rather than stored', () => {
    const cat = catalogue(10, 20);
    let state = startChallenge(cat, firstAlways, AT);
    for (let i = 0; i < 3; i++) state = win(state, cat);
    state = loss(state, cat);
    state = win(state, cat);

    const p = progress(state, cat);
    expect(p.total).toBe(10);
    expect(p.cleared).toBe(1);
    expect(p.remaining).toBe(9);
    expect(p.deaths).toBe(1);
    expect(p.matches).toBe(5);
    expect(p.gearSpent).toEqual({head: 1, clothes: 1, shoes: 1});
    expect(p.gearTotals).toEqual({head: 20, clothes: 20, shoes: 20});
  });

  it('counts down to the next life', () => {
    const cat = catalogue(30);
    let state = startChallenge(cat, firstAlways, AT);
    expect(progress(state, cat).winsToNextLife).toBe(10);

    for (let i = 0; i < 4; i++) state = win(state, cat);
    expect(progress(state, cat).winsToNextLife).toBe(6);

    for (let i = 0; i < 6; i++) state = win(state, cat);
    expect(progress(state, cat).winsToNextLife).toBe(10);
  });
});
