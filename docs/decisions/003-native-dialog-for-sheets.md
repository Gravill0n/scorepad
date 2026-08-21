# ADR-003: Bottom sheets and the delete confirm are a native `<dialog>`

## Status
Accepted

## Date
2026-08-19

## Context
`SPEC.md` says bottom sheets are the only overlay and that the app has exactly one
confirmation dialog (deleting a session). Both need a backdrop, a focus trap, `Esc`, and
inertness for the content behind them.

## Decision
Use a native `<dialog>` with `showModal()`. Styling makes it a bottom sheet.

## Alternatives considered

### A positioned `<div>` with a hand-rolled focus trap
- Pros: total control over animation and stacking.
- Cons: focus trapping, inertness, `Esc`, and restoring focus on close are four things to
  get right and keep right, and getting them wrong is invisible until somebody uses a
  keyboard or a screen reader.
- Rejected: the browser already does all four correctly.

### A headless UI library
- Pros: the same four things, tested.
- Cons: a dependency for what `<dialog>` does natively.
- Rejected: see ADR-001's last line.

## Consequences
- **Styling a sheet as a dialog does not make it a *dialog* in the spec's UX sense.** The
  rule "no dialogs except delete" governs the interaction pattern, not the tag.
- The panel must finish its exit animation *before* the dialog closes: unmounting an open
  modal `<dialog>` skips `--dur-sheet` and drops focus on the floor. Controls inside a sheet
  are handed a `close` callback rather than being allowed to unmount it.
- jsdom implements neither `showModal` nor `close`, so `vitest.setup.ts` shims both. The
  shim provides **no focus trap** — that guarantee belongs to the browser and is not
  verified in the test suite.
