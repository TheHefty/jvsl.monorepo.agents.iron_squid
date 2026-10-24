Feature: Share link
  A player can hand anyone a link to their run.

  Scenario: Copying the link
    Given a player with a run in progress
    When the player copies the link to the run
    Then the link is on the player's clipboard
    And the player is told, in words and to a screen reader, that it was copied

  Scenario: Sharing from a phone
    Given a player on a device that offers a share sheet
    When the player shares the run
    Then the device's share sheet opens with the link to the run

  Scenario: The run travels after the "#"
    When a player copies the link to the run
    Then the run is carried in the part of the link after "#"
    And the link has no query string

  Scenario: A link to a complete run is short enough to paste anywhere
    Given a complete run of 160 kits with a display name of 30 characters
    When the player copies the link to the run
    Then the link is at most 2000 characters long

  Scenario: A link is a snapshot
    Given a player copied the link to their run with 12 kits conquered
    When the player wins three more matches
    Then the link they copied still shows 12 kits conquered
