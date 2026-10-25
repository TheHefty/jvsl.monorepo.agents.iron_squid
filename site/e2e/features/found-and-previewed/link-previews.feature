Feature: Link previews
  A link to the site, posted where links show a preview, shows the site's
  name, what the page is, and the logo.

  Scenario: A posted link has a preview
    When a preview generator reads the home page at "/en-US/"
    Then it finds the title "Iron Squid"
    And the page's description
    And an image, with its width, height and a text alternative

  Scenario: The preview speaks the page's language
    When a preview generator reads the home page at "/pt-BR/"
    Then the description is in Brazilian Portuguese
    And the preview names the language as "pt_BR"

  Scenario: The image comes from the site itself
    When a preview generator reads any page
    Then the preview image's address starts with "https://iron-squid.top/"
    And opening that address returns an image

  Scenario: The image is the site's own, not Nintendo's
    Then the preview image carries the site's logo and no game artwork

  Scenario: A shared run previews as the site
    Given a link to a run with the display name "Inkling Ivo"
    When a preview generator reads the link
    Then the preview is the same as the home page's
    And "Inkling Ivo" appears nowhere in what it read

  Scenario: The preview adds no request to anyone else
    Given the published site
    When a visitor loads every page
    Then no request is made to any host other than the site's own
