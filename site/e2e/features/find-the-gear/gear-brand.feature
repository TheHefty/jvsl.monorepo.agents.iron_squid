Feature: Gear brand
  Every gear piece shows its brand, so the player knows which shop or
  locker to look in.

  Scenario: A drawn piece shows its brand
    Given a player has been given a set
    Then the headgear, the clothing and the shoes each show their brand's icon

  Scenario: The brand is named for screen readers
    Given a player using a screen reader
    When the player reads the current set
    Then each gear piece's brand is read by its name

  Scenario: The brand's name follows the language
    Given a player on the "/ja-JP/" address with a set drawn
    Then each brand is named in Japanese

  Scenario: A shared run shows the brands
    When a visitor opens a link to a run with conquered sets
    Then each conquered set's gear shows its brand's icon

  Scenario: Brand icons come from the site itself
    Given the published site
    When a visitor loads every page
    Then every brand icon is served by the site
    And no request is made to any host other than the site's own

  Scenario: A brand icon that does not match its digest fails the build
    Given a brand icon whose downloaded bytes do not match the committed digest
    When the site is built
    Then the build fails, naming the icon, the expected digest and the one received

  Scenario: Brand icons are never committed
    Then no file tracked in the repository has the bytes of a brand icon
