Feature: Finish a run
  A run ends when every kit in the game has been won with.

  Scenario: Winning with the last kit completes the run
    Given a player with 159 of 160 kits conquered
    When the player reports a win with the last kit
    Then the player is told the run is complete
    And the player is shown how many matches, wins, losses and resets it took

  Scenario: A complete run draws nothing more
    Given a complete run
    Then the player is not offered a next set
    And the player can start a new run

  Scenario: A complete run stays complete
    Given a complete run
    When the player reloads the page
    Then the run is still shown as complete

  Scenario: Undoing the final win
    Given a player has just completed the run
    When the player undoes the last win
    Then the run is no longer complete
    And the player is playing the last kit again

  Scenario: Completion is announced
    Given a player using a screen reader
    When the player completes the run
    Then the screen reader announces that the run is complete
