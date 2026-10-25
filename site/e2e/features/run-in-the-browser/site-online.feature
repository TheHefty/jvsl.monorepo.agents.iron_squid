Feature: The site is online
  Iron Squid is published from main to its own domain, and a change that
  breaks it cannot reach main.

  @deployed
  Scenario: A released version reaches the domain
    Given a version has been cut
    When a visitor opens the project's domain once the publication has finished
    Then the site loads over HTTPS
    And it is that version's build

  @deployed
  Scenario: Plain HTTP is upgraded
    When a visitor opens the project's domain over plain HTTP
    Then they are sent to the same address over HTTPS

  Scenario: The root sends the visitor to a locale
    When a visitor opens the root of the domain
    Then they arrive at the "/en-US/" address

  Scenario: An address that does not exist says so
    When a visitor opens an address the site does not have
    Then they see a page that says the page does not exist
    And it links back to the home page

  @manual
  Scenario: A change whose tests fail cannot be merged
    Given a pull request whose tests fail
    Then GitHub does not allow it to be merged
    And the failed check is named on the pull request

  Scenario: A page with an inaccessible control fails the accessibility check
    Given a page that has a control with no accessible name
    When the accessibility check runs on it
    Then the check fails, naming the control

  @manual
  Scenario: A change that fails the accessibility check cannot be merged
    Given a pull request whose accessibility check fails
    Then GitHub does not allow the pull request to be merged

  Scenario: The site makes no request to anyone else
    Given the published site
    When a visitor loads every page
    Then no request is made to any host other than the site's own
