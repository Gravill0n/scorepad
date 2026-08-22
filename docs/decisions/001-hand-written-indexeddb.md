# ADR-001: Hand-write `lib/db.ts` over raw IndexedDB

## Status
Accepted

## Date
2026-08-19

## Context
The scaffold arrived with `@tanstack/react-db` and `@tanstack/query-db-collection` wired to
a collection that wrapped a **server function** — the one thing this app does not have. The
data model is two object stores (`sessions`, `meta`) and a schema-version integer. `SPEC.md`
listed "does TanStack DB ship a local adapter, or is a hand-written store simpler?" as the
last stack question standing.

## Decision
Delete both packages and hand-write `src/lib/db.ts` over raw IndexedDB: `open`, `get`,
`put`, `getAll`, `delete`, plus `meta` accessors and an ordered migration runner that ships
at version 1 with zero migrations.

## Alternatives considered

### Adapt `@tanstack/react-db` to an IndexedDB collection
- Pros: already installed; declarative queries.
- Cons: it is a query-oriented layer for *server* state. Adapting it to an offline store
  means writing the adapter anyway and then learning its concepts on top.
- Rejected: more code and more vocabulary than the four verbs the model needs.

### Dexie or idb
- Pros: mature, ergonomic, small.
- Cons: a dependency for what turned out to be ~200 lines, and every dependency is a
  permanent surface on a project whose whole architecture is "there is no network".
- Rejected: the wrapper is smaller than the decision to take one.

## Consequences
- The migration mechanism exists before it is needed, so the first real migration is not a
  data-loss event.
- `fake-indexeddb` is a devDependency (the plan's only added dependency) because jsdom has
  no IndexedDB. It is imported in the vitest setup and nowhere under `src/`, asserted by a
  test.
- A failed open surfaces an error rather than resolving to an empty store — silently
  reading zero sessions is how somebody loses an evening.
