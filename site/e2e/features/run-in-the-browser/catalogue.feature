Feature: The catalogue
  Draws are made from every kit and every wearable gear piece in the game,
  taken from a pinned copy of the game data.

  Background:
    Given the site is built from the game data for version 11.3.0

  Scenario: Every kit available online is in the catalogue
    Then the catalogue has 160 kits

  Scenario Outline: Replicas are not kits
    Then the catalogue does not contain the <replica>

    Examples:
      | replica                     |
      | Hero Shot Replica           |
      | Octo Shot Replica           |
      | Order Shot Replica          |
      | Plastic-Bottle Shot Replica |

  Scenario: Gear that cannot be worn online is not in the catalogue
    Then the catalogue contains no gear the game marks as unobtainable for online battles
    And it contains no gear that exists only inside Hero Mode or Side Order

  Scenario: Gear earned in Hero Mode or Side Order is in the catalogue
    Then the catalogue contains the Hero Mode and Side Order rewards a player can wear online

  Scenario: Every kit and gear piece has a name and an image
    Then every kit in the catalogue has its official en-US name and its image
    And every gear piece in the catalogue has its official en-US name and its image

  Scenario: The game version is shown
    When a visitor opens any page
    Then the page says the catalogue matches Splatoon 3 version 11.3.0

  Scenario: An image that does not match its digest stops the build
    Given an image whose content differs from the digest recorded for it
    When the site is built
    Then the build fails
    And the failure names the file, the digest expected and the digest received

  Scenario: An image that cannot be downloaded stops the build
    Given an image the build cannot download
    When the site is built
    Then the build fails
    And the failure names the file and the address it was fetched from

  Scenario: A gear slot too small for a whole run stops the build
    Given game data in which one gear slot has fewer pieces than there are kits
    When the site is built
    Then the build fails
    And the failure names the slot, how many pieces it has and how many kits there are

  Scenario: No game image is in the repository
    Then no image from the game is tracked in the repository

  Scenario: A game update reaches the site as a reviewable change
    Given the pin on the game data is moved to a newer commit
    When the catalogue is regenerated
    Then the change to the catalogue shows which kits and gear were added and which were removed
