Feature: Design alignment
  The site is as crooked as its design: tilted stickers, skewed buttons,
  angled panels and splattered ink.

  Scenario: Labels sit tilted
    Given a player with a run in progress
    Then the stickers, tags and log marks on the run page are each rotated a few degrees
    And neighbouring stickers lean in different directions

  Scenario: Buttons are skewed
    Given a player with a run in progress
    Then every button on the run page is skewed
    And the text inside each button stands upright

  Scenario: Panels are cut at an angle
    Given a player with a run in progress
    Then the current set sits in a panel with one corner cut at an angle

  Scenario: The ink strip is splattered and slanted
    When a visitor opens the home page
    Then the ink strip at the top carries several splats
    And its lower edge is slanted

  Scenario: The drawn kit is named in display type
    Given a player has been given a set
    Then the kit's name is in uppercase display type

  Scenario: The rules are stickers
    Given a visitor with no run
    When the visitor opens the home page
    Then the challenge's rules are shown as tilted stickers, in two columns

  Scenario: Wins and losses are marked in the log
    Given a run with a win and a loss
    When the player opens the run log
    Then the win is marked with an ink blot and the loss with an outlined mark
    And each mark says in words whether it was a win or a loss

  Scenario: A shared run leads with a headline
    When a visitor opens a link to a run with 40 kits conquered
    Then the page leads with a headline about the run
    And its kits conquered, kits to go, lives and resets stand in one row

  Scenario: Body text is never rotated
    When a visitor loads every page
    Then no paragraph of text is rotated

  Scenario: Focus is never cut off
    Given a visitor using only a keyboard
    When the visitor moves focus through every control of the run page
    Then the focus ring of each control is fully visible, including next to a cut corner

  Scenario: The crooked layout fits a phone
    Given a phone screen 360 pixels wide
    When a player plays a set
    Then nothing on the page needs scrolling sideways

  Scenario: A draw is still under reduced motion
    Given a device that asks for reduced motion
    When a player is given a new set
    Then the kit's splat does not move
