Feature: Redraw the logo
  The logo is a squid in the game's style: round eyes in a dark mask,
  rounded contours, in the site's own iron grey.

  Scenario: The logo has round eyes in a dark mask
    When a visitor opens any page of the site
    Then the logo shows two round white eyes, each with a dark pupil, set in a dark mask

  Scenario: The logo's contours are rounded
    Then the logo's outline has no sharp corner

  Scenario: The logo keeps the iron grey
    Then the logo's body is drawn in the iron grey of the site's mark

  Scenario: The logo is the site's own drawing
    Then the logo is a file of the site, drawn for it, and is no image from the game

  Scenario: The link preview shows the new logo
    When a visitor's link to the site is posted
    Then its preview image is made from the logo the site carries
