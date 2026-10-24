import { describe, expect, it } from 'vitest';
import { countScenarios, countScenariosTagged, missingFromRun, scenariosTagged } from './scenarios';

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

  it('leaves out the scenarios a registration marks as pending, outlines included', () => {
    expect(countScenarios(feature, ['manual', 'deployed'], ['many'])).toBe(1);
    expect(countScenarios(feature, ['manual', 'deployed'], ['plain'])).toBe(3);
  });
});

describe('countScenariosTagged', () => {
  it('counts only the scenarios carrying a tag, for the run that executes them', () => {
    expect(countScenariosTagged(feature, 'deployed')).toBe(1);
    expect(countScenariosTagged(feature, 'nothing')).toBe(0);
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
      '4 scenario(s) expected from the registered features, 0 executed',
    );
  });
});
