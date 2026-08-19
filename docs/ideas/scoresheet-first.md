# Scoresheet-First Board Game Counter

> Direction and rationale. The scope it replaced (`docs/FEATURES.md`, `docs/plan/`) has
> been deleted; see git history for it. The implementable source of truth is
> [`docs/spec/`](../spec/SPEC.md), which supersedes this document where they differ.

## Problem Statement

**How might we replace the end-of-game scoring pass — the error-prone, argument-inducing
ten minutes where five players tally six categories each — with a sheet that already
knows the game being played?**

Not "a counter that can hold numbers." A library of the actual scoresheets, where picking
*Wingspan* gives you Wingspan's six categories rather than a generic `+1` button.

## Recommended Direction

**Template-first, client-only.** Scoresheets are declarative JSON; one generic renderer
draws any of them. The app is a static bundle plus IndexedDB — no server, no accounts, no
Postgres, no sync. Offline isn't a feature to build; it's a property of having no backend
to be disconnected from.

This is deliberately the inverse of the existing plan. That plan treated live `+1/-1`
tapping as the core (old `FEATURES.md` §3) with templates and categories as v1.1 extras
(§7, §9). But mid-game score tracking is largely a non-problem: heavy games hide VP until
the end, light games have a track printed on the board. The pain is concentrated in the
final tally. So categories and templates *are* the product, and the generic counter is the
fallback for games without a sheet.

Modelling sheets as data rather than code is the load-bearing decision. It makes adding a
game cost zero code, keeps the app static, and leaves room for user-authored templates
later without a rewrite — which is the only viable answer to the content treadmill
(you ship 6 games; a stranger plays a 7th and leaves).

The server is deferred, not rejected. See assumption 1 for what will bring it back.

### Grammar v0

Deliberately impoverished. No formula engine.

```json
{
  "id": "wingspan",
  "name": "Wingspan",
  "players": [1, 5],
  "categories": [
    { "key": "birds",  "label": "Birds" },
    { "key": "bonus",  "label": "Bonus cards" },
    { "key": "goals",  "label": "End-of-round goals" },
    { "key": "eggs",   "label": "Eggs" },
    { "key": "food",   "label": "Food on cards" },
    { "key": "tucked", "label": "Tucked cards" }
  ],
  "total": "sum",
  "win": "highest"
}
```

`total: "sum"` covers most games. 7 Wonders' science (n² + 7 per set-of-three) is the
canonical exception and is the test case that decides whether formulas are needed at
all — it is not a reason to build them on day one.

### Seed library

Catan · Wingspan · Ticket to Ride · 7 Wonders · Azul · Splendor

These span the full range by accident: Catan has no categories (validates the counter
fallback), 7 Wonders needs more than `sum` (breaks the grammar immediately, which is
where you want to find out).

**Superseded:** four card games (Uno, Whist, Belote, Black Lady) were added during
specification, taking the seed library to ten. They forced round-based `tally` mode back
into the grammar — see `../spec/template-grammar.md`.

## Key Assumptions to Validate

- [ ] **The grammar generalizes across all six seed games.** Test: write the JSON for all
      six *on paper, before building the renderer*. If three don't fit, that cost an hour
      instead of three weekends. Cheapest high-value check in the project.
- [ ] **IndexedDB survives between game nights on iOS.** Safari evicts storage for sites
      unused ~7 days unless installed to the home screen. A group that plays monthly could
      lose everything. Test: install the PWA, don't touch it for two weeks, see what's
      left. Mitigations: `navigator.storage.persist()`, push Add-to-Home-Screen, ship JSON
      export from day one.
- [ ] **A PWA is a real distribution channel for this audience.** No store listing, hidden
      iOS install gesture. Test: one BGG forum post once it works. Unambiguous answer.
- [ ] **People will pull out a phone for end-game scoring at all.** Some tables won't.
      Test: your own group, roughest possible version, one real session.
- [ ] **The end-game tally is the real pain, not live tracking.** If groups keep asking for
      mid-game running totals, the whole direction inverts back toward the original plan.

## MVP Scope

**In:**
- Client-only PWA. IndexedDB is the only store. No accounts, no network calls.
- Six seed templates as JSON files in the repo.
- Core flow: pick game → add players → fill the sheet → totals, ranking, winner → saved to
  local history.
- Generic counter fallback (single category, +/-) for games with no template.
- Local history list of past sessions.
- JSON export/import — the durability escape hatch while there's no server.

**Out:** everything else. See below.

**Data model:** keep the shape of `GameSession` / `Player` / `ScoreEvent` from
`prisma/schema.prisma` as TypeScript types over IndexedDB. Drop `roomCode`, `hostId`, and
`SessionParticipant` (sync artifacts). Append-only score events survive — still the best
call in the original plan, and it makes undo and per-category entry fall out for free.

### Repo consequences

Delete: `prisma/`, `src/generated/prisma/` (388K), `src/db.ts`, `src/server/`,
`@prisma/client`, `@prisma/adapter-pg`, `prisma`, `@faker-js/faker`, `dotenv-cli`, all
`db:*` scripts, and the whole of `docs/plan/` — all now removed.

Keep: TanStack Start, TanStack DB (as the client store), HeroUI, Tailwind, Paraglide,
Biome, Vitest.

Verify early: (a) that the installed `@tanstack/db` ships a local/IndexedDB collection
adapter, and (b) that TanStack Start builds cleanly with no server. If either fights back,
dropping to plain Vite + React costs nothing currently in use.

## Not Doing (and Why)

- **Multi-device sync** — highest-cost item in the original plan, and cutting it removes
  conflict resolution, sync queues, room codes, permissions and the WebSocket server in
  one stroke. A read-only spectator link recovers most of its value for ~10% of the price,
  if it turns out to be wanted at all.
- **Server / accounts / Postgres** — nothing needs it until assumption 2 fails. When it
  does, it comes back as dumb per-session backup, not as a sync engine.
- **Live `+1/+5` tap scoreboard with animated reordering** (old `FEATURES.md` §3) — elaborate
  work on the least valuable moment of the game.
- **Score calculators, formula engine** (§11) — build only if 7 Wonders proves `sum`
  insufficient across multiple games, not just one.
- **Stats, leaderboards, player profiles** (§13–15) — untestable until someone uses a
  scoresheet twice. Also where BG Stats is genuinely strong; no reason to fight there.
- **BGG collection import** — good idea, wrong time. Distribution problem, not a product
  problem.
- **Timers, dice roller, photos, random player order, themes** (§16–20) — unrelated apps
  wearing a trenchcoat.
- **User-authored templates in v1** — the grammar must exist from the start, the authoring
  UI must not. Hand-editing JSON is fine until strangers ask.

## Open Questions

- Does 7 Wonders' science scoring force a formula concept into grammar v0, or can it be a
  one-off `"total": "custom"` escape hatch handled by the renderer?
- Do negative categories (Agricola-style penalties) need a grammar flag, or does allowing
  negative numbers in any category cover it?
- Is per-round scoring (Wingspan's four rounds) part of the grammar or
  deliberately flattened into single end-game categories for v1? Flattening is the lazy
  answer and probably right.
- What happens on the *second* game night — does the app remember players across sessions
  without any profile concept? A recently-used-names list is likely enough.
