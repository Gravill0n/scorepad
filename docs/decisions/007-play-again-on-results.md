# ADR-007: `Play again` is a fourth action on Results

## Status
Accepted — a deliberate departure from artboards `1n` / `1o`

## Date
2026-08-19

## Context
The artboards draw three footer actions on Results (`Reopen`, `Export`, `Back to games`).
The handoff *prose* lists `Play again`. Finishing a game is the moment a table actually asks
for another one.

## Decision
Reinstate `Play again`. It calls the same `duplicateSession` as Home's swipe action and
routes to the new session, leaving the finished one untouched. The paired footer row becomes
three-up rather than gaining a band, so the screen's height budget is unchanged.

## Alternatives considered

### Leave it to Home's swipe-`Duplicate`
- Pros: no departure; one entry point.
- Cons: it asks somebody to leave the screen, find the row, and discover a gesture, at the
  one moment the intent is loudest.
- Rejected.

### Add a fourth band to the footer
- Pros: no crowding.
- Cons: Results already carries a winner card, a conditional tiebreak card and a ranked list;
  at twelve players the band budget is what gives.
- Rejected: `SPEC.md` §7 says the button is what survives, not the band.

## Consequences
- One function, two entry points — a duplicate behaves identically wherever it is asked for,
  including the `(2)` suffix.
- Three ~111px buttons must hold `Rejouer` / `Rouvrir` / `Exporter`. They do, but only after
  **dropping the icons `1n` draws on `Reopen` and `Export`** — a 16px glyph plus its gap is
  exactly the room French needs.
- Owed to the designer, with the rest of the departures listed at the foot of
  [`../plan/IMPLEMENTATION.md`](../plan/IMPLEMENTATION.md).
