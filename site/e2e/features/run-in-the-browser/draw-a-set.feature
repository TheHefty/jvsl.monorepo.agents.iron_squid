Feature: Draw a set
  A run gives the player one set at a time, at random, and the player
  plays the set they were given.

  Scenario: Starting a first run
    Given a player with no run
    When the player starts a run
    Then the player is shown a kit, a headgear, a clothing piece and a shoes piece
    And the player has 1 life
    And 0 of 130 kits are conquered

  Scenario: Naming the run
    Given a player starting a run
    When the player gives the run the display name "Inkling Ivo"
    Then the run is shown as "Inkling Ivo"
    And the player is told the name is visible to anyone who receives a link to the run

  Scenario: A display name is optional
    When a player starts a run without a display name
    Then the run starts and is played the same way

  Scenario: A display name longer than 30 characters is refused
    When a player enters a display name of 31 characters
    Then the player is told the name can have at most 30 characters
    And the run is not started until the name is shortened or removed

  Scenario: Starting over asks first
    Given a player with a run in progress
    When the player starts a new run
    Then the player is asked to confirm, and told the current run will be discarded
    When the player declines
    Then the run in progress is unchanged

  Scenario Outline: The set does not change behind the player's back
    Given a player has been given a set
    When the player <does something>
    Then the player is shown the same set

    Examples:
      | does something              |
      | reloads the page            |
      | closes and reopens the browser |
      | opens the site in a new tab |

  Scenario: A draw never repeats a conquered kit or a used gear piece
    Given a run with conquered sets
    When the player is given a new set
    Then its kit is not one already conquered in this run
    And none of its gear pieces has been drawn before in this run

  Scenario: The next set comes when the player asks for it
    Given the player has just reported a win
    Then the player is shown the set they just conquered
    When the player asks for the next set
    Then the player is shown the next set

  Scenario: Undoing a win does not re-roll the next set
    Given the player has reported a win and been shown the next set
    When the player undoes the win and reports the win again
    Then the player is shown the same next set as before
