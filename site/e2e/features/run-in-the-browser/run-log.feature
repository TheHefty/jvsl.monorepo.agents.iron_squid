Feature: Run log
  Every match of a run is kept in the order it was played, and the player
  can read it back.

  Scenario: A win is logged
    Given a player playing a set with 3 of 160 kits conquered
    When the player reports a win
    Then the newest entry of the run log is that set, marked as a win
    And it says 4 of 160 kits were conquered after it

  Scenario: A loss is logged with the lives it left
    Given a player playing a set with 2 lives
    When the player reports a loss
    Then the newest entry of the run log is that set, marked as a loss with 1 life left

  Scenario: A reset is marked where it happened
    Given a player with 12 conquered sets and 1 life
    When the player reports a loss
    Then the run log marks a reset right after that loss

  Scenario: A replay is marked as a replay
    Given a player replaying after a reset
    When the player reports a win
    Then the newest entry of the run log is marked as a replay

  Scenario: An undone result leaves the log
    Given a player has just reported a result
    When the player undoes it
    Then that result is no longer in the run log

  Scenario: Every entry says when it was reported
    Given a player reported a win on 24 October 2026
    Then the entry for that win shows that date, written for the player's locale

  Scenario: The whole run is in the log, newest first
    Given a run with 200 reported matches
    When the player opens the run log
    Then it lists all 200 matches, the newest first

  Scenario: The log is kept with the run
    Given a player who has reported a match
    When the player closes the browser and opens the site again
    Then the run log still holds that match

  Scenario: The log is a list a screen reader can read
    Given a player using a screen reader
    When the player opens the run log
    Then each entry is read as one item, with the kit, the result and the lives left
