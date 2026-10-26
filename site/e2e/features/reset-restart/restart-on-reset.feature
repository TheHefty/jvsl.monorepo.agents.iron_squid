Feature: Restart on reset
  Losing the last life starts the run over from nothing: every kit conquered
  is lost, and the whole run is drawn again.

  Scenario: A reset loses every kit conquered
    Given a player with 12 conquered kits and 1 life in a new run
    When the player reports a loss
    Then 0 of 160 kits are conquered
    And the player has 1 life
    And the run shows 1 reset

  Scenario: A reset draws every kit again
    Given a player with 12 conquered kits and 1 life in a new run
    When the player reports a loss
    Then the run's order of kits is drawn again, from every kit in the game
    And the player is playing the first set of that new order, not a replay

  Scenario: A reset draws the gear again from the whole catalogue
    Given a player who re-rolled away a piece and then lost the last life
    When the run has reset
    Then every gear piece of the catalogue can be drawn again
    And every spare is there again for a re-roll

  Scenario: Undo cannot draw the reset again
    Given a player who has just lost the last life and seen the new first set
    When the player undoes the loss and reports it again
    Then the new first set is the same as before

  Scenario: The run keeps its log through a reset
    Given a player with 12 conquered kits and 1 life in a new run
    When the player reports a loss
    Then the run log still lists the 13 matches before the reset
    And marks the loss that reset the run

  Scenario: A complete run is every kit without a reset between
    Given a player with 159 kits conquered since the last reset
    When the player reports a win
    Then the run is complete

  Scenario: A shared run shows the kits conquered since the last reset
    Given a run that reset after 12 conquered kits and has won 3 since
    When a visitor opens a link to the run
    Then the visitor sees 3 of 160 kits conquered, and those 3 sets

  Scenario: A run begun under the reshuffled reset keeps it
    Given a run begun under the reshuffled reset, with 12 conquered kits and 1 life
    When the player reports a loss
    Then the player replays the same 12 kits

  Scenario: A run begun before reshuffling keeps replaying in order
    Given a run started before replays were reshuffled, with 12 conquered sets and 1 life
    When the player reports a loss
    Then the player is playing the first set they conquered, with the same gear

  Scenario: A new run starts over at each reset
    Given a player who starts a new run
    Then the run starts over from nothing at each reset
