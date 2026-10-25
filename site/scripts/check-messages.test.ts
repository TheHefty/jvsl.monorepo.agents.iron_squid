import { describe, expect, it } from 'vitest';
import { messageProblems } from './check-messages';

// A source catalogue and one translation, small enough to read; each test breaks the translation in
// one way and expects the build to be refused naming the locale and the key (NFR-I7).
const source = {
  'translation.status': 'reviewed',
  'run.won': 'I won',
  'run.lives': '{lives, plural, one {# life} other {# lives}}',
  'announce.win': 'Won with {kit}. {lives}.',
};
const pt = {
  'translation.status': 'unreviewed',
  'run.won': 'Venci',
  'run.lives': '{lives, plural, one {# vida} other {# vidas}}',
  'announce.win': 'Venceu com {kit}. {lives}.',
};
const check = (translation: Record<string, string>, locale = 'pt-BR') =>
  messageProblems({ 'en-US': source, [locale]: translation }, 'en-US');

describe('messageProblems', () => {
  it('passes a complete, well-formed translation', () => {
    expect(check(pt)).toEqual([]);
  });

  it('names the locale and the key a translation lacks', () => {
    const { 'run.won': _, ...missing } = pt;
    void _;
    expect(check(missing)).toEqual(['pt-BR lacks "run.won", which en-US has']);
  });

  it('refuses a key the source does not have, which nothing would ever show', () => {
    expect(check({ ...pt, 'run.wonn': 'Venci' })).toEqual([
      'pt-BR has "run.wonn", which en-US does not',
    ]);
  });

  it('refuses a message that is not valid ICU', () => {
    expect(check({ ...pt, 'run.lives': '{lives, plural, one {# vida}' })).toEqual([
      expect.stringMatching(/^pt-BR "run.lives" is not a valid message: /),
    ]);
  });

  it('refuses a translation whose arguments differ from the source (failure 2)', () => {
    expect(check({ ...pt, 'announce.win': 'Venceu com {arma}. {lives}.' })).toEqual([
      'pt-BR "announce.win" uses {arma, lives}; en-US uses {kit, lives}',
    ]);
  });

  it('refuses a plural missing a form its language uses for whole numbers (failure 2)', () => {
    const ru = {
      ...pt,
      'run.lives': '{lives, plural, one {# жизнь} other {# жизней}}',
    };
    expect(check(ru, 'ru-RU')).toEqual([
      'ru-RU "run.lives" has no plural form "few", "many" for {lives}',
    ]);
    const complete = {
      ...pt,
      'run.lives': '{lives, plural, one {# жизнь} few {# жизни} many {# жизней} other {# жизни}}',
    };
    expect(check(complete, 'ru-RU')).toEqual([]);
  });

  it('does not ask for a form only compact numbers take, such as Portuguese "many"', () => {
    expect(new Intl.PluralRules('pt-BR').resolvedOptions().pluralCategories).toContain('many');
    expect(check(pt)).toEqual([]);
  });

  it('refuses a review status other than reviewed or unreviewed (NFR-I4)', () => {
    expect(check({ ...pt, 'translation.status': 'maybe' })).toEqual([
      'pt-BR "translation.status" is "maybe"; it must be "reviewed" or "unreviewed"',
    ]);
  });
});
