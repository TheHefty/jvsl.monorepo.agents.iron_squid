Feature: Report a match
  The player says how each match went, and the run follows the rules.

  Scenario: A win conquers the set
    Given a player playing a set with 1 life and 3 of 160 kits conquered
    When the player reports a win
    Then the set is conquered
    And 4 of 160 kits are conquered
    And the player is shown the set they just conquered

  Scenario: Every tenth win earns a life
    Given a player with 1 life and 9 wins since the run started
    When the player reports a win
    Then the player has 2 lives

  Scenario: Wins towards the next life are shown
    Given a player with 13 wins since the run started
    Then the player is shown that 7 more wins earn the next life

  Scenario: A loss with lives to spare costs one
    Given a player playing a set with 2 lives
    When the player reports a loss
    Then the player has 1 life
    And the player is playing the same set again

  Scenario: Undoing a loss
    Given a player with 2 lives has just reported a loss
    When the player undoes it
    Then the player has 2 lives
    And the run is exactly as it was before the loss was reported

  Scenario: Undoing a win
    Given a player has just reported the win that earned a life
    When the player undoes it
    Then the set is no longer conquered
    And the life it earned is gone

  Scenario: Only the last result can be undone
    Given a player has reported two results
    When the player undoes the second
    Then the first result can no longer be undone

  Scenario: The state of the run is always visible
    Given a player with a run in progress
    Then the player is shown how many kits are conquered out of the total
    And how many lives they have
    And how many wins until the next life
    And the current set
    And how many resets the run has had

  Scenario: A result is announced
    Given a player using a screen reader
    When the player reports a result
    Then the screen reader announces the result and the lives the player now has
