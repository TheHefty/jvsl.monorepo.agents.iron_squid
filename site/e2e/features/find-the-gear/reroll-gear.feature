Feature: Re-roll gear
  A player who does not have a drawn piece of gear can re-roll it, and the
  piece they gave up is spent.

  Scenario: Re-rolling a piece
    Given a player has been given a set with the shoes "Orange Arrows"
    When the player re-rolls the shoes
    Then the set has other shoes
    And its kit, headgear and clothing are unchanged

  Scenario: The kit cannot be re-rolled
    Given a player has been given a set
    Then the player is offered a re-roll for the headgear, the clothing and the shoes
    And none for the kit

  Scenario: A piece re-rolled away is spent
    Given a player re-rolled away the shoes "Orange Arrows"
    When the player plays on through every remaining set of the run
    Then "Orange Arrows" is never drawn again

  Scenario: Re-rolling as often as the player needs
    Given a player has been given a set
    When the player re-rolls the headgear three times
    Then the set has a fourth headgear
    And the three before it are spent

  Scenario: A re-roll that would leave the run short is refused
    Given a run with 5 kits still to draw after the current set
    And 5 shoes not yet used, besides the current set's
    When the player tries to re-roll the shoes
    Then the re-roll is refused
    And the player is told there are no more shoes to spare than the kits still to draw

  Scenario: A re-roll that leaves enough is allowed
    Given a run with 5 kits still to draw after the current set
    And 6 shoes not yet used, besides the current set's
    When the player re-rolls the shoes
    Then the set has other shoes

  Scenario: No re-roll once a result is reported
    Given a player who lost a match with the current set and has lives left
    Then the player is offered no re-roll

  Scenario: A replay keeps its gear in a run started before replays were reshuffled
    Given a player replaying a conquered set after a reset, in a run started before replays were reshuffled
    Then the player is offered no re-roll

  Scenario: A re-roll survives a reload
    Given a player re-rolled the clothing of the current set
    When the player reloads the page
    Then the set has the clothing it was re-rolled to

  Scenario: The same re-roll gives the same piece
    Given two copies of the same run, at the same set
    When the player re-rolls the shoes in each
    Then both get the same shoes

  Scenario: A re-roll cannot be undone
    Given a player has just re-rolled the shoes
    Then the player is offered no way to undo the re-roll

  Scenario: Undoing a result keeps the re-rolls before it
    Given a player re-rolled the headgear and then reported a loss
    When the player undoes the loss
    Then the set still has the re-rolled headgear

  Scenario: Re-rolls are in the run log
    Given a player re-rolled away the shoes "Orange Arrows"
    When the player opens the run log
    Then the log says "Orange Arrows" was re-rolled away, where it happened

  Scenario: A shared run counts its re-rolls
    Given a run in which 4 pieces were re-rolled away
    When a visitor opens a link to the run
    Then the visitor is shown that 4 pieces were re-rolled away

  Scenario: Re-rolling works from the keyboard
    Given a player using only a keyboard
    Then the player can re-roll each gear piece from the keyboard

  Scenario: A re-roll is announced
    Given a player using a screen reader
    When the player re-rolls the clothing
    Then the screen reader announces the new clothing
