Feature: Reshuffle the replays
  Every reset is a new test: the conquered kits come back in a new order,
  each with gear dealt out again from what they were won with.

  Scenario: A reset replays the conquered kits in a new order
    Given a player with 12 conquered kits and 1 life
    When the player reports a loss
    Then the player replays the same 12 kits
    And in an order drawn for this reset

  Scenario: The replays wear the conquered gear, dealt out again
    Given a player with 12 conquered kits and 1 life
    When the player reports a loss
    Then the replays wear exactly the headgear, clothing and shoes the 12 kits were won with
    And not every kit wears the gear it was won with

  Scenario: No unused piece is spent on a replay
    Given a player with 12 conquered kits and 1 life
    When the player reports a loss and wins every replay
    Then the first new draw after the replays is the one that was next before the reset

  Scenario: Each reset draws again
    Given a player who has reset once and replayed every conquered kit
    When the player loses the last life again
    Then the replays come in a new order, with the gear dealt out again

  Scenario: Undo cannot draw the replays again
    Given a player who has just lost the last life and seen the first replay
    When the player undoes the loss and reports it again
    Then the replays are the same, in the same order, with the same gear

  Scenario: A replay is said to be one
    Given a player replaying after a reset, with 12 conquered kits
    When the player is playing the fifth replay
    Then the player is shown that this set is a replay
    And that 8 replays remain before new draws

  Scenario: A replay can be re-rolled
    Given a player on a replay, before any result for it
    When the player re-rolls its shoes
    Then the replay has other shoes
    And the shoes given up are not dealt out at the next reset

  Scenario: No re-roll once the replay has a result
    Given a player on a replay who lost a match with it and has lives left
    Then the player is offered no re-roll

  Scenario: A shared run shows the gear each kit was first conquered with
    Given a player replaying after a reset
    When a visitor opens a link to the run
    Then each conquered kit is shown with the gear it was first conquered with

  Scenario: A run started before the change keeps the earlier reset
    Given a run started before replays were reshuffled, with 12 conquered sets and 1 life
    When the player reports a loss
    Then the player replays the conquered sets in the order they were conquered, with the same gear
    And the player is offered no re-roll on a replay

  Scenario: A new run follows the new reset
    Given a player who starts a new run
    Then the run replays in a new order at each reset
