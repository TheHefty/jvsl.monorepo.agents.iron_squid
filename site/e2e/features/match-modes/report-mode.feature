Feature: Report the mode
  Every result says which mode the match was played in, and a win moves
  straight on to the next set.

  Scenario: Winning asks for the mode
    Given a player playing a set
    When the player reports a win
    Then the player is asked which mode the match was played in
    And the choices are Turf War, Splat Zones, Tower Control, Rainmaker, Clam Blitz and Tricolor Turf War

  Scenario: Choosing the mode records the win and draws the next set
    Given a player playing a set with 3 of 160 kits conquered
    When the player reports a win in Tower Control
    Then 4 of 160 kits are conquered
    And the player is told which set they just conquered
    And the player is shown the next set without asking for it

  Scenario: Losing asks for the mode too
    Given a player playing a set with 2 lives
    When the player reports a loss in Rainmaker
    Then the player has 1 life
    And the player is playing the same set again

  Scenario: Dismissing the choice records nothing
    Given a player playing a set
    When the player reports a win
    And dismisses the choice of mode
    Then no result is recorded
    And the player is playing the same set

  Scenario: The mode is in the run log
    Given a player reported a win in Splat Zones and then a loss in Clam Blitz
    When the player opens the run log
    Then the newest entry is the loss, in Clam Blitz
    And the entry before it is the win, in Splat Zones

  Scenario: A match from before modes were recorded
    Given a run whose first matches were reported before the site recorded modes
    When the player opens the run log
    Then those matches say their mode was not recorded

  Scenario: Undoing a win brings its set back
    Given a player has just reported a win in Turf War and been shown the next set
    When the player undoes it
    Then the player is playing the set they won with, not yet conquered
    And the win is no longer in the run log

  Scenario: Undoing does not change what comes next
    Given a player who reported a win in Turf War, undid it, and reported it again in Rainmaker
    Then the player is shown the same next set as the first time

  Scenario: A shared run shows the mode of each conquest
    Given a player conquered a set in Tower Control
    When a visitor opens a link to the run
    Then the conquered set is shown with Tower Control

  Scenario: Links made before modes still open
    Given a link to a run made before the site recorded modes
    When a visitor opens it
    Then the run is shown as it was, with no mode on its sets

  Scenario: A file exported before modes still imports
    Given a run file exported before the site recorded modes
    When the player imports it
    Then the run continues where it was

  Scenario: A complete run's link is still short enough to paste anywhere
    Given a complete run of 160 kits, each won in a mode, with a display name of 30 characters
    When the player copies the link to the run
    Then the link is at most 2000 characters long

  Scenario: The choice of mode works from the keyboard
    Given a player using only a keyboard
    When the player reports a win
    Then the player can choose any mode, and dismiss the choice, from the keyboard

  Scenario: The new set is announced
    Given a player using a screen reader
    When the player reports a win in Splat Zones
    Then the screen reader announces the conquered set and the next set
