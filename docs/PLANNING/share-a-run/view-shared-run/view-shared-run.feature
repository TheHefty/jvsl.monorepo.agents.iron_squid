Feature: View a shared run
  A link shows someone else's run without touching the visitor's own.

  Scenario: Opening a shared run
    When a visitor opens a link to a run named "Inkling Ivo" with 12 of 130 kits conquered
    Then the visitor sees the run named "Inkling Ivo"
    And 12 of 130 kits conquered
    And the conquered sets, in the order they were conquered
    And the run's lives and resets
    And whether the run is complete

  Scenario: A shared run cannot be changed
    When a visitor opens a link to a run
    Then the visitor is not offered to report a result, undo or draw a set for it

  Scenario: The visitor's own run is untouched
    Given a visitor with a run of their own in progress
    When the visitor opens a link to someone else's run
    Then the visitor's own run is unchanged
    And the visitor is offered a way back to it

  Scenario: A visitor without a run is offered one
    Given a visitor with no run
    When the visitor opens a link to someone else's run
    Then the visitor is offered to start a run of their own

  Scenario: A display name is shown as text
    When a visitor opens a link to a run whose display name is "<b>Ivo</b>"
    Then the visitor sees the name exactly as "<b>Ivo</b>"

  Scenario: A malformed link says so
    When a visitor opens a link whose run cannot be read
    Then the visitor is told the link is broken
    And no part of a run is shown

  Scenario: A link whose run breaks the rules is refused
    When a visitor opens a link to a run in which a gear piece was used twice
    Then the visitor is told the link is broken
    And no part of a run is shown

  Scenario: A link from a catalogue the site no longer carries says so
    When a visitor opens a link to a run on a catalogue version the site does not carry
    Then the visitor is told which catalogue version the run needs
