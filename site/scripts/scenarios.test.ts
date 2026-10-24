import { describe, expect, it } from 'vitest';
import { countScenarios, missingFromRun, scenariosTagged } from './scenarios';

const feature = `Feature: F

  Scenario: plain
    Given a

  @manual
  Scenario: by hand
    Given b

  @deployed
  Scenario: live
    Given c

  Scenario Outline: many
    Given <x>

    Examples:
      | x |
      | 1 |
      | 2 |
      | 3 |
`;

describe('countScenarios', () => {
  it('counts every scenario CI should run, expanding outlines and leaving out tagged ones', () => {
    expect(countScenarios(feature, ['manual', 'deployed'])).toBe(4);
  });
});

describe('scenariosTagged', () => {
  it('lists the scenarios carrying a tag, by name', () => {
    expect(scenariosTagged(feature, 'manual')).toEqual(['by hand']);
  });
});

describe('missingFromRun', () => {
  it('says how many expected scenarios a run did not execute', () => {
    expect(missingFromRun({ expected: 4, executed: 4 })).toBeUndefined();
    expect(missingFromRun({ expected: 4, executed: 0 })).toBe(
      'acceptance: 4 scenario(s) expected from the registered features, 0 executed',
    );
  });
});
