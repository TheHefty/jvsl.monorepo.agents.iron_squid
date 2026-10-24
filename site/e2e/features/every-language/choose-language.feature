Feature: Choose a language
  The site speaks the visitor's language when it can, and lets them pick.

  Scenario: The first visit follows the browser
    Given a browser whose preferred language is "ja-JP"
    When the visitor opens the root of the site for the first time
    Then the visitor arrives at the "/ja-JP/" address

  Scenario: A language offered under another region
    Given a browser whose preferred language is "pt-PT"
    When the visitor opens the root of the site for the first time
    Then the visitor arrives at the "/pt-BR/" address

  Scenario: A language the site does not offer
    Given a browser whose preferred language is "sv-SE"
    When the visitor opens the root of the site for the first time
    Then the visitor arrives at the "/en-US/" address

  Scenario: Switching language keeps the visitor where they were
    Given a visitor with a run in progress, on the "/en-US/" address
    When the visitor switches to "Deutsch (Deutschland)"
    Then the visitor is on the "/de-DE/" address of the same page
    And the run is unchanged

  Scenario: The choice is remembered
    Given a visitor who switched to "Français (Canada)"
    When the visitor later opens the root of the site
    Then the visitor arrives at the "/fr-CA/" address

  Scenario: An address in a locale opens in that locale
    Given a visitor who switched to "Español (México)"
    When the visitor opens a link to the "/ko-KR/" address
    Then the page is in Korean

  Scenario: Each language is named in itself
    When a visitor opens the language switcher
    Then each language is listed by its own name, such as "日本語" and "Русский"

  Scenario: The language switcher works from the keyboard
    Given a visitor using only a keyboard
    Then the visitor can reach the language switcher and choose any language
