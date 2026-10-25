Feature: Theme switch
  A player picks the light or the dark theme from the header, and the site
  keeps to it.

  Scenario: The first visit follows the system
    Given a device set to a light appearance
    When a visitor opens the site for the first time
    Then the site is in the light theme
    And the header's theme control shows "Light" as chosen

  Scenario: Switching to dark
    Given a visitor on the light theme
    When the visitor chooses "Dark" in the header
    Then the site is in the dark theme at once, without reloading

  Scenario: The choice is remembered
    Given a visitor who chose "Dark" on a device set to a light appearance
    When the visitor closes the browser and opens the site again
    Then the site is in the dark theme

  Scenario: The choice outlives a change of language
    Given a visitor who chose "Light"
    When the visitor switches to "日本語"
    Then the site is still in the light theme

  Scenario: The control is on every page
    When a visitor opens any page of the site
    Then the header has the theme control

  Scenario: The theme control works from the keyboard
    Given a visitor using only a keyboard
    Then the visitor can reach the theme control and choose either theme

  Scenario Outline: Both themes meet the contrast rules
    Given the site is in the <theme> theme
    When a visitor loads every page and every state of a run
    Then no page has an accessibility violation

    Examples:
      | theme |
      | light |
      | dark  |

  Scenario: The privacy notice says what is remembered
    When a visitor reads the privacy notice
    Then it says the theme choice is kept in the browser and never sent
