import 'server-only';

import {cache} from 'react';
import {loadCatalogue} from '@/data/catalogue';
import {drawFrom} from '@/domain/challenge';
import {challengeService} from '@/service/container';
import {serverRng} from '@/service/rng';
import type {Locale} from '@/i18n/routing';
import {viewChallenge, type ChallengeView} from './view';

/**
 * What the landing page renders.
 *
 * The roll card shows whoever is playing right now — which is what mock 1b
 * depicts, and the reason it was chosen over 1a. On a site with no challenges
 * there is nobody to show, so it falls back to a draw taken from the catalogue
 * and labelled as an example. That fallback is a real state, not a placeholder:
 * it is what the first visitor sees, and it still shows the mechanic the page
 * is describing.
 */

export type Landing =
  | {kind: 'live'; runs: number; completed: number; challenge: ChallengeView}
  | {kind: 'sample'; runs: number; completed: number; draw: SampleDraw};

export type SampleDraw = ReturnType<typeof sampleDraw>;

function sampleDraw(catalogue: Awaited<ReturnType<typeof loadCatalogue>>) {
  const drawn = drawFrom(
    catalogue,
    [],
    {head: [], clothes: [], shoes: []},
    serverRng
  );

  const named = (slot: 'head' | 'clothes' | 'shoes') =>
    catalogue.gear[slot].find((item) => item.id === drawn.gear[slot])!;

  return {
    weapon: catalogue.weapons.find((w) => w.id === drawn.weaponId)!,
    gear: {
      head: named('head'),
      clothes: named('clothes'),
      shoes: named('shoes')
    }
  };
}

export const landing = cache(async (locale: Locale): Promise<Landing> => {
  const service = await challengeService();
  const [{runs, completed, latest}, catalogue] = await Promise.all([
    service.overview(),
    loadCatalogue(locale)
  ]);

  if (!latest) {
    return {kind: 'sample', runs, completed, draw: sampleDraw(catalogue)};
  }

  return {
    kind: 'live',
    runs,
    completed,
    challenge: viewChallenge(latest.state, catalogue, latest.handle)
  };
});
