Feature: Share the log
  A shared run shows its whole story: every match in its log, and the
  longest run of wins the player strung together.

  Scenario: A shared run shows its log
    Given a run of 3 wins, a loss in Splat Zones and 2 more wins
    When a visitor opens a link to the run
    Then the visitor sees its 6 matches, newest first
    And each says its result, its kit and its mode

  Scenario: The shared log says nothing about when the player played
    Given a run of 3 wins, a loss in Splat Zones and 2 more wins
    When a visitor opens a link to the run
    Then no match on the shared log shows a date

  Scenario: Replays and resets are marked on the shared log
    Given a run begun under the reshuffled reset that lost its last life and won a replay
    When a visitor opens a link to the run
    Then the shared log marks the loss that reset the run
    And marks the replay as a replay

  Scenario: The longest winning streak is shown
    Given a run of 5 wins, a loss, 8 wins, a loss and 3 wins
    When a visitor opens a link to the run
    Then the visitor is shown a longest winning streak of 8

  Scenario: Wins in a replay count towards the streak
    Given a run begun under the reshuffled reset that reset, then won its 12 replays and 3 new sets
    When a visitor opens a link to the run
    Then the visitor is shown a longest winning streak of 15

  Scenario: A long run's link carries its most recent matches
    Given a complete run of 3000 matches with a display name of 30 characters
    When the player copies the link to the run
    Then the link is at most 2000 characters long
    And a visitor sees the most recent matches, told how many earlier ones are left out

  Scenario: A link made before the log was shared still opens
    Given a link to a run made before the log was shared
    When a visitor opens it
    Then the run is shown as it was
    And the visitor is told the link carries no log
