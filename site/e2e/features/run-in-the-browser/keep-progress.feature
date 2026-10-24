Feature: Keep progress
  A run is kept in the player's browser, and can be moved as a file.

  Scenario: A run survives the browser being closed
    Given a player with a run in progress
    When the player closes the browser and opens the site again
    Then the run is exactly where it was

  Scenario: The player is told when progress cannot be kept
    Given a browser that does not let the site store anything
    When the player opens the site
    Then the player is told the run will not be kept when the page closes
    And the player is offered to export it instead

  Scenario: Exporting a run
    Given a player with a run in progress
    When the player exports the run
    Then the player receives a file holding the run

  Scenario: Importing a run on another device
    Given a file exported from a run in progress
    When a player with no run imports it on another device
    Then the run continues exactly where it was when exported

  Scenario: Importing over a run asks first
    Given a player with a run in progress
    When the player imports a file
    Then the player is asked to confirm, and told the current run will be replaced
    When the player declines
    Then the run in progress is unchanged

  Scenario: A file that is not a run is refused
    When a player imports a file that is not a valid run
    Then the import is refused
    And the player is told the file is not a valid Iron Squid run
    And the run in progress is unchanged

  Scenario: A run from a catalogue the site does not carry is refused
    When a player imports a run that names a catalogue version the site does not carry
    Then the import is refused
    And the player is told which catalogue version the file needs

  Scenario: A run continues on its catalogue after the site is updated
    Given a player with a run started on catalogue version 11.3.0
    And the site has since been rebuilt from a newer catalogue version
    When the player opens the site
    Then the run continues against catalogue version 11.3.0
    And the player is told the run is on an older catalogue
    And kits added since are not part of the run
