# ADR-004: Swipe-to-reveal on a Home row is CSS scroll-snap

## Status
Accepted

## Date
2026-08-19

## Context
A Home row reveals `Delete` and `Duplicate` on a left swipe (`1d`). There is no per-row bin
icon anywhere.

## Decision
Make the row a horizontally scrollable container with `scroll-snap-align` on the content and
on the action pane behind it.

## Alternatives considered

### A gesture library
- Pros: velocity, rubber-banding, the usual polish.
- Cons: a dependency for one interaction, and the risk flagged in the plan's own risk table
  that a bespoke gesture grows into one anyway.
- Rejected.

### Pointer-event maths
- Pros: no dependency.
- Cons: it is one axis and one threshold until it is momentum, cancellation and pointer
  capture — and it is never keyboard-reachable without building that separately.
- Rejected.

## Consequences
- The actions are **real buttons in a real scroll container**, so they are reachable by
  keyboard and assistive tech without a second code path.
- It is the one horizontal scroll on the app besides hand history. `contracts.test.tsx`
  allows exactly these two files and fails on a third.
