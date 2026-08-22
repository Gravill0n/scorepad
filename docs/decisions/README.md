# Architecture decisions

Decisions the spec left to implementation, recorded because **nothing in the build enforces
them**. The import graph is convention and review; the "no network" rule is an assumption
with no runtime guard; the choice not to take a dependency is invisible in the code that
resulted. A future reader sees the consequence and not the reasoning, which is exactly the
kind of decision that gets quietly re-litigated.

Each record is short on purpose. The full order of work is
[`../plan/IMPLEMENTATION.md`](../plan/IMPLEMENTATION.md); the source of truth for *what* the
app does is [`../spec/SPEC.md`](../spec/SPEC.md).

| # | Decision | Status |
|---|---|---|
| [001](001-hand-written-indexeddb.md) | Hand-write `lib/db.ts` over raw IndexedDB | Accepted |
| [002](002-no-fetch-cache.md) | No fetch cache; one store over `useSyncExternalStore` | Accepted |
| [003](003-native-dialog-for-sheets.md) | Bottom sheets are a native `<dialog>` | Accepted |
| [004](004-scroll-snap-swipe.md) | Swipe-to-reveal is CSS scroll-snap | Accepted |
| [005](005-no-input-for-scores.md) | Score entry never uses an `<input>` | Accepted |
| [006](006-session-store-in-lib.md) | The session store lives in `lib/`, not a feature | Accepted |
| [007](007-play-again-on-results.md) | `Play again` is a fourth Results action | Accepted |
| [008](008-paraglide-from-the-first-string.md) | Paraglide from the first string | Accepted |

## Writing a new one

Copy the shape of an existing record: **Status · Date · Context · Decision · Alternatives
considered · Consequences.** Do not edit an accepted record to reverse it — write a new one
that supersedes it, and mark the old one `Superseded by ADR-XXX`. The history is the point.
