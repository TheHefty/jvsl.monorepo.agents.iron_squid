Feature: Localized names
  Every kit and gear piece is called what the game calls it in the
  visitor's locale.

  Scenario Outline: Names follow the locale's game data
    Given a visitor on the "<locale>" address
    Then every kit and gear piece is shown with its name from the game's "<game data>" data

    Examples:
      | locale | game data |
      | en-US  | USen      |
      | en-GB  | EUen      |
      | es-ES  | EUes      |
      | es-MX  | USes      |
      | fr-FR  | EUfr      |
      | fr-CA  | USfr      |
      | de-DE  | EUde      |
      | it-IT  | EUit      |
      | nl-NL  | EUnl      |
      | ru-RU  | EUru      |
      | ja-JP  | JPja      |
      | ko-KR  | KRko      |
      | zh-CN  | CNzh      |
      | zh-TW  | TWzh      |
      | pt-BR  | USen      |

  Scenario: Image descriptions follow the locale
    Given a visitor on the "fr-FR" address
    Then every kit and gear image is described by its French name

  Scenario: A shared run reads in the visitor's locale
    Given a link to a run made on the "en-US" address
    When a visitor opens it on the "ja-JP" address
    Then the run's kits and gear are shown with their Japanese names

  Scenario: A missing name stops the build
    Given game data in which a kit has no name in one locale
    When the site is built
    Then the build fails
    And the failure names the kit and the locale
