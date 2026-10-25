Feature: Deploy on release
  What players see is a version cut by release-please, and the acceptance
  tests decide whether it can be cut.

  @manual
  Scenario: A merge into main publishes nothing
    Given the site is published at version 1.4.0
    When a change is merged into main
    Then the published site is still version 1.4.0

  @deployed
  Scenario: Cutting a version publishes it
    Given release-please's pull request proposes version 1.5.0
    When the pull request is merged
    Then the tag v1.5.0 is created
    And the published site is built from that tag once the publication has finished

  @manual
  Scenario: A release whose acceptance fails cannot be cut
    Given release-please's pull request on which an acceptance scenario fails
    Then GitHub does not allow it to be merged
    And the failed scenario is named on the pull request

  @manual
  Scenario: A release with an accessibility violation cannot be cut
    Given release-please's pull request on which the accessibility check fails
    Then GitHub does not allow it to be merged

  @manual
  Scenario: An ordinary pull request is not held by acceptance
    Given a pull request that is not release-please's
    Then its required checks are the build, the type check, the lint, the unit tests and the repository settings
    And the acceptance tests do not run on it

  @manual
  Scenario: A pull request that breaks its unit tests still cannot be merged
    Given a pull request whose unit tests fail
    Then GitHub does not allow it to be merged
