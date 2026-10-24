Feature: Translate the interface
  The site's own words are in the visitor's language.

  Scenario: Every page is fully translated
    Given a visitor on any of the 15 locale addresses
    Then every text on every page is in that locale's language
    And so are the notices, the error messages and the screen-reader announcements

  Scenario: A missing translation stops the build
    Given a locale missing a text that en-US has
    When the site is built
    Then the build fails
    And the failure names the locale and the missing text

  Scenario Outline: Plurals follow the language
    Given a visitor on the "<locale>" address
    When the player has <lives> lives
    Then the number of lives is written with that language's plural form for <lives>

    Examples:
      | locale | lives |
      | en-US  | 1     |
      | en-US  | 2     |
      | ru-RU  | 1     |
      | ru-RU  | 3     |
      | ru-RU  | 5     |

  Scenario: Numbers and dates follow the locale
    Given a visitor on the "de-DE" address
    Then numbers and dates are written as German writes them

  Scenario: An unreviewed translation says so
    Given a locale whose translation no fluent speaker has reviewed
    When a visitor is on that locale's address
    Then the page says the translation has not been reviewed
    And the language switcher marks that language as unreviewed

  Scenario: The README lists the unreviewed translations
    When someone reads the README
    Then it lists every locale whose translation has not been reviewed
