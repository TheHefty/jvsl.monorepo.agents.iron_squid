Feature: Reset and replay
  Losing the last life sends the player back through every set they have
  already conquered.

  Scenario: Losing the last life resets the run
    Given a player with 12 conquered sets and 1 life
    When the player reports a loss
    Then the run has reset
    And the player has 1 life
    And the player is playing the first set they conquered, with the same gear
    And the run shows 1 reset

  Scenario: A replay follows the order of conquest
    Given a player replaying after a reset
    When the player wins with the first conquered set
    Then the player is playing the second conquered set, with the same gear

  Scenario: A replay says it is a replay
    Given a player replaying after a reset, with 12 conquered sets
    When the player is playing the fifth of them
    Then the player is shown that this set is a replay
    And that 8 replays remain before new draws

  Scenario: Wins during a replay earn lives
    Given a player replaying after a reset, with 9 wins since the reset
    When the player reports a win
    Then the player has 2 lives

  Scenario: A loss during a replay with lives to spare
    Given a player replaying after a reset, with 2 lives
    When the player reports a loss
    Then the player has 1 life
    And the player is playing the same replayed set again

  Scenario: Losing the last life during a replay resets again
    Given a player replaying the seventh of 12 conquered sets, with 1 life
    When the player reports a loss
    Then the player is playing the first conquered set again
    And the run shows one more reset

  Scenario: New draws resume after the replay
    Given a player replaying the last of 12 conquered sets
    When the player reports a win
    And the player asks for the next set
    Then the player is given a set that is not one of the 12
    And none of its gear pieces has been drawn before in this run

  Scenario: Losing the last life with nothing conquered
    Given a player with no conquered sets and 1 life
    When the player reports a loss
    Then the run shows 1 reset
    And the player is playing the same set again, with 1 life

  Scenario: Undoing the loss that caused a reset
    Given a player whose last loss reset the run
    When the player undoes it
    Then the player is playing the set they lost with, with 1 life
    And the run shows the resets it had before that loss
