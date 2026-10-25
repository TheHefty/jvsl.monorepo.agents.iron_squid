Feature: Described to search engines
  Every page tells a search engine what it is, and where the same page is
  in every other language.

  Scenario Outline: Every page has a description in its own language
    When a search engine reads the <page> at "/<locale>/"
    Then the page has a description
    And the description is in the language of "<locale>"

    Examples:
      | page           | locale |
      | home page      | en-US  |
      | home page      | pt-BR  |
      | home page      | ja-JP  |
      | privacy notice | de-DE  |
      | terms of use   | ko-KR  |

  Scenario: Every page names itself in every other language
    When a search engine reads the home page at "/fr-FR/"
    Then the page names its own address in every locale the site offers
    And each address is marked with its language

  Scenario: A default is named for every other language
    When a search engine reads the home page at "/es-MX/"
    Then the page names the root of the site as the default for any other language

  Scenario: The names agree in both directions
    Given every page the site publishes
    Then every address one page names as its sibling names that page back

  Scenario: The addresses are absolute and on the site's own domain
    When a search engine reads any page
    Then every address it names starts with "https://iron-squid.top/"

  Scenario: A page the site does not have is not indexed
    When a search engine reads an address the site does not have
    Then the page tells it not to index the page
