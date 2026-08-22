# ADR-002: No fetch cache; one store subscribed with `useSyncExternalStore`

## Status
Accepted

## Date
2026-08-19

## Context
The scaffold carried `@tanstack/react-query` and `@tanstack/react-router-ssr-query`. The
app's first assumption is that **there are zero network requests by design**.

## Decision
Drop both. Reads come from one module (`lib/sessions.ts`) holding the loaded sessions,
subscribed to with `useSyncExternalStore`. The router loses
`setupRouterSsrQueryIntegration`.

## Alternatives considered

### Keep React Query, pointed at IndexedDB
- Pros: familiar hooks; caching and invalidation for free.
- Cons: a fetch cache with nothing to fetch. Staleness, retries and refetch windows are all
  answers to a question local storage does not ask.
- Rejected: the concepts cost more than the code they save.

### A context provider holding sessions in state
- Pros: no external-store subtlety.
- Cons: every write re-renders the whole tree under the provider.
- Rejected: `useSyncExternalStore` is the platform's answer and is already in React.

## Consequences
- Writes are serialised in the store and re-read the session inside the write, which is what
  stops two quick cell edits building on one stale snapshot.
- The published list is frozen, so a component cannot mutate shared state by accident.
- The flow tests can assert **zero** calls to `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource` and `sendBeacon`, because there is no library that might make one.
