Feature: Logo and favicon
  The site carries a mark of its own, in the tab and in the header.

  Scenario: The tab shows the site's icon
    When a visitor opens any page of the site
    Then the browser tab shows Iron Squid's icon
    And the icon is served by the site itself

  Scenario: The header carries the logo
    When a visitor opens any page of the site
    Then the header shows Iron Squid's logo beside its name

  Scenario: The logo leads home
    Given a visitor on the privacy notice in "/pt-BR/"
    When the visitor activates the logo
    Then the visitor is on the home page, in the same language

  Scenario: The logo has a name for screen readers
    Given a visitor using a screen reader
    When the visitor reaches the logo
    Then it is read as "Iron Squid, home"

  Scenario: The icon reads on a light and on a dark tab bar
    Then the icon has a contrast of at least 3:1 against white and against black
