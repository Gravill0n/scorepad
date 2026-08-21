# ADR-005: Score entry never uses an `<input>`

## Status
Accepted

## Date
2026-08-19

## Context
`SPEC.md` lists "use the system keyboard for score entry" under **Never**.

## Decision
The keypad writes to React state directly. No `<input>`, no `inputMode` trickery, no hidden
field the system keyboard can find.

## Alternatives considered

### `<input inputMode="numeric">`
- Pros: free caret, selection, and platform behaviour.
- Cons: the system keyboard has unpredictable height, no room for `±` or a hand-over button,
  and **no way to say whose number is being typed** — which is the entire pass-the-phone
  affordance.
- Rejected: the affordance is the product.

## Consequences
- A cell being typed is a **string**, not a number: `""` is not `0`, `"-"` is a minus waiting
  for digits, and `"05"` must not survive as five. Those rules live in
  `utils/keypadValue.ts` with a case per value shape, because this is one of the three
  surfaces where a mis-tap costs data.
- Writing the tests settled a rule the spec left open: `⌫` on `-4` leaves `-`, not `""`. The
  sign was typed deliberately, and one press should never delete two things.
- The focused cell renders **what is being typed**, not what has come back from the
  database. A round trip's lag is where the person's eyes are.
