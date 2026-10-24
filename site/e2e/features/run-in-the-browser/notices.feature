Feature: Notices
  Every page says whose names and images these are, and links to what a
  visitor may want to read before using the site.

  Scenario Outline: Every page links to the notices
    Given a visitor is on any page of the site
    Then the page links to the <notice>

    Examples:
      | notice          |
      | terms of use    |
      | privacy notice  |
      | security policy |

  Scenario: Every page carries the fan-project notice
    Given a visitor is on any page of the site
    Then the page says the site is a fan project
    And it says the site is not affiliated with or endorsed by Nintendo
    And it says Splatoon's names and images belong to Nintendo

  Scenario: The privacy notice says what is kept, and where
    When a visitor reads the privacy notice
    Then it lists the run, the optional display name and the language choice
    And it says they are kept only in the visitor's own browser
    And it says the site sends none of them anywhere

  Scenario: The privacy notice names the host
    When a visitor reads the privacy notice
    Then it says GitHub serves the site and receives what any web host receives
    And it links to GitHub's privacy statement

  Scenario: The privacy notice warns about the display name
    When a visitor reads the privacy notice
    Then it says a display name is visible to anyone who receives a link to the run

  Scenario: The privacy notice says how to make a request
    When a visitor reads the privacy notice
    Then it says how to contact the maintainer about it
    And it says requests about the host's records go to GitHub

  Scenario: The legal texts say they have not been reviewed
    When a visitor reads the terms of use or the privacy notice
    Then the text says it has not been reviewed by a lawyer
