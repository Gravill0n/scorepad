# ADR-006: The session store lives in `lib/`, not in a feature

## Status
Accepted

## Date
2026-08-19

## Context
`CLAUDE.md` and `README.md` both state the rule: `features/sessions` and
`features/scoresheet` never import each other, and anything both need moves to `lib/`,
`types/` or `utils/`. Both features write sessions — `sessions` creates, duplicates and
deletes them; `scoresheet` persists every cell edit and, after ADR-007, duplicates too.

## Decision
`src/lib/sessions.ts` holds create, read, list, update, delete, `duplicateSession`,
`setCell`, and the `useSessions` hook.

## Alternatives considered

### Keep it in `features/sessions` and import it from `features/scoresheet`
- Pros: no move.
- Cons: it is exactly the cross-feature import the rule exists to prevent, and the rule has
  no linter behind it — so the first exception is the last one.
- Rejected.

### Inject the write functions from the app layer
- Pros: technically respects the graph.
- Cons: indirection whose only purpose is to avoid moving a file.
- Rejected: it is a way of not doing what the rule says.

## Consequences
- The same reasoning moved `backup.ts` into `lib/` at task 28, when Results needed export and
  Home already had it. The rule is applied when the second caller appears, not predicted.
- `features/sessions/api/` keeps only what is Home-specific: importing a backup, and starting
  a session.
- `ResultsScreen`, the screen most tempted to reach across, imports **no feature module at
  all**.
