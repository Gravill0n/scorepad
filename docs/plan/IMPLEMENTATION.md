# Implementation Plan: Scorepad v1

Derived from [`../spec/SPEC.md`](../spec/SPEC.md), [`data-model.md`](../spec/data-model.md),
[`template-grammar.md`](../spec/template-grammar.md) and the sixteen artboards in
[`../design_handoff_scorepad/`](../design_handoff_scorepad/README.md).

The spec is the source of truth. This file is the order of operations and nothing else — if
the two disagree, the spec wins and this file is wrong.

## Overview

Thirty-three tasks in eight phases. The repo today is a `create-tanstack-app` scaffold wired
to Prisma/PostgreSQL with server functions and a `SessionParticipant` model — three things
the spec lists under **Never**. Phase 0 is therefore subtraction, not addition. After that,
the pure core (scoring, template validation, seed templates) lands before any pixel, because
it is the only code in the app that can be silently wrong; then one vertical slice per screen
group, each leaving a working app.

## Which skill runs which task

One skill per task, grouped where consecutive tasks share one. From
`agent-skills` — invoke it *before* starting the task, not as a post-hoc label.

| Tasks | Skill | Why this one |
|---|---|---|
| 1 | `deprecation-and-migration` | Task 1 removes a whole subsystem (Prisma, server functions, HeroUI). The risk is deleting something load-bearing, which is exactly what this skill's removal checklist is for |
| 2, 10 | `incremental-implementation` | Config and shell work — tokens, vitest, provider, routes. No logic to test-drive, but each step must leave the app running |
| 3, 9 | `api-and-interface-design` | The shared types and the session store are the contracts every later task is written against. Task 9 is also where the `lib/` vs `features/` boundary is decided (decision 6) |
| 4–8, 23 | `test-driven-development` | The scoring engine, template validation, the eleven templates, the IndexedDB module and the tally utils. This is all the code that can be **silently wrong** — failing test first, every time. The `divideBy: 3` regression is the canonical case |
| 11–18, 19–22, 24–29 | `frontend-ui-engineering` | Every screen task. The artboard is the acceptance criteria; the skill's accessibility floor and the spec's 44px/16px contracts are the same requirement stated twice |
| 30 | `shipping-and-launch` | Manifest, service worker, installability — the pre-launch checklist is the shape of this task |
| 31 | `ci-cd-and-automation` | The Pages workflow is a quality gate before it is a deploy: lint and tests must pass before anything reaches the URL people install from |
| 32 | `test-driven-development` | The contract assertions. If the `chrome-devtools` MCP server is configured, pair with `browser-testing-with-devtools` for the 390 × 844 French render — real viewport, real layout |
| 33 | `documentation-and-adrs` | The eight decisions above are ADR material. Record the why, since the import rules have no linter behind them |
| every checkpoint | `code-review-and-quality` | The five-axis pass at A–G, before the next phase builds on top |
| every commit | `git-workflow-and-versioning` | One task, one atomic commit |

Two run underneath all of them and are not in the table: `debugging-and-error-recovery` the
moment anything breaks, and `code-simplification` whenever a task's diff outgrows what it
was asked to do. Reach for `doubt-driven-development` at exactly three points — task 8
(durability: a bug here loses somebody's evening), task 25 (the hand **must** save when it
does not balance) and task 31 (a service-worker scope failure is silent and only shows up
offline).

## Architecture decisions taken here

These are decisions the spec left to implementation. Each is the laziest option that meets
the contract; each is reversible inside one file.

1. **Hand-write `src/lib/db.ts` over raw IndexedDB. Drop `@tanstack/react-db` and
   `@tanstack/query-db-collection`.** This closes the spec's last stack open question. The
   data model is two object stores and a version integer; a query-oriented collection layer
   adapted to an offline store is more code and more concepts than `open`, `get`, `put`,
   `getAll`. Nothing in use is lost — the current collection wraps a *server* function.
2. **Drop `@tanstack/react-query` and `@tanstack/react-router-ssr-query` with it.** There are
   zero network requests by design (assumption 1), so a fetch cache has nothing to cache.
   Reads come from one module holding the loaded sessions, subscribed to with
   `useSyncExternalStore`. `src/router.tsx` loses `setupRouterSsrQueryIntegration`.
3. **Bottom sheets and the delete confirm are native `<dialog>`.** Backdrop, focus trap,
   `Esc` and inertness are free and correct. Styling makes it a bottom sheet; that is a
   rendering choice and does not make the sheet a *dialog* in the spec's UX sense — the
   spec's rule ("no dialogs except delete") governs the interaction pattern, not the tag.
4. **Swipe-to-reveal on a Home row is CSS scroll-snap**, not a gesture library and not
   pointer-event maths: a horizontally scrollable row, `scroll-snap-align` on the content
   and on the action pane behind it. No dependency, works with a thumb, keyboard-reachable.
5. **Score entry never uses an `<input>`.** The keypad writes to React state directly. No
   `inputMode` trickery, no hidden field the system keyboard can find.
6. **The session store lives in `src/lib/sessions.ts`, not in a feature.** Both features
   write sessions — `sessions` creates, duplicates and deletes them; `scoresheet` persists
   every cell edit and now duplicates too (`Play again`, decision 7). The spec's own rule
   says anything both need moves to `lib/`, and this is the alternative to a cross-feature
   import. `features/sessions/api/` keeps only what is Home-specific: export and import.
7. **`Play again` is approved on Results** (2026-08-19) — a deliberate departure from
   `1n` / `1o`, recorded in `SPEC.md` §7. It calls the same `duplicateSession` as Home's
   swipe action and then routes to the new session. One function, two entry points.
8. **Paraglide from the first string.** Retrofitting i18n is a whole-tree diff; writing
   `m.next_category()` from task one costs nothing extra. French translation and the layout
   audit are a later task, the message calls are not.

## Dependency graph

```
Phase 0  strip scaffold ── tokens ── vitest
             │
Phase 1  types ── scoring.ts ── templates/validate.ts ── seed templates + registry
             │
Phase 2  lib/db.ts ── lib/sessions.ts (store, shared by both features)
             │
Phase 3  app shell (provider, router, routes) ── Home ── delete/duplicate ── backup
             │
Phase 4  picker ── setup rows ── BottomSheet + ColourSheet ── validation + create
             │                                    │
Phase 5  Keypad ── sheet screen ── keypad wiring ──┤   (mode: "sheet")
Phase 6  tally utils ── standings ── EntrySheet ── ledger ── history   (mode: "tally")
             │
Phase 7  Results
             │
Phase 8  French pass ── PWA ── deploy ── contract tests ── success-criteria walkthrough
```

---

## Phase 0 — Strip and pin

### Task 1: Remove the server stack

**Description:** Delete every Prisma, PostgreSQL, server-function and HeroUI trace, and pin
the build to a client-only output. This is the spec's task 0.

**Acceptance criteria:**
- [x] Deleted: `prisma/`, `prisma.config.ts`, `src/db.ts`, `src/generated/`, `src/server/`,
      `src/data/`, `src/routes/test.page.tsx`, `src/integrations/tanstack-query/`.
- [x] Removed from `package.json`: `prisma`, `@prisma/client`, `@prisma/adapter-pg`,
      `@faker-js/faker`, `dotenv-cli`, `nitro`, `@heroui/react`, `@heroui/styles`,
      `@tanstack/react-table`, `@tanstack/react-form`, `@tanstack/match-sorter-utils`,
      `@tanstack/query-db-collection`, `@tanstack/react-db`, `@tanstack/react-query`,
      `@tanstack/react-query-devtools`, `@tanstack/react-router-ssr-query`, and all `db:*`
      plus `post-cta-init` scripts. `lucide-react` stays.
- [x] `vite.config.ts`: `nitro()` plugin gone, SPA mode enabled on `tanstackStart` (verify
      the option name against the installed version — do not copy it from memory).
- [x] `tsconfig.json`: only the `@/*` alias survives; `@Components/*`, `@Data/*`,
      `@Hooks/*`, `@Server/*` removed.
- [x] `src/router.tsx` builds the router with no query-client context.
- [x] The scaffold's names go with it: `package.json` `name` becomes `scorepad`, and the
      document title in `root.layout.tsx` stops reading `Board Game Counter`. The product is
      Scorepad, and Home's header renders that wordmark.

**Verification:**
- [x] `bun install && bun run build` succeeds and `dist/` contains `index.html` and no
      server entry (`.output/server`, `server.js`, nitro artifacts absent).
- [x] `grep -ril "prisma\|heroui\|react-query" src/` returns nothing **in code**. It now
      matches one comment line in `src/tokens.css` ("HeroUI overrides"), which task 2 copies
      byte-identically from the design bundle. Not fixable here without breaking that
      byte-identity — it is owed to the designer instead.
- [x] `bun run lint` clean.

**Dependencies:** None. **Scope:** M (mostly deletion). **Risk:** the SPA-mode option name.

### Task 2: Tokens, stylesheet, vitest

**Description:** Copy the design bundle's tokens in verbatim and give the repo a test runner.

**Acceptance criteria:**
- [x] `src/tokens.css` is byte-identical to `docs/design_handoff_scorepad/tokens.css`.
- [x] `src/styles.css` is `@import "tailwindcss";` + `@import "./tokens.css";` — the
      `@heroui/styles` and typography-plugin imports are gone.
- [x] `vite.config.ts` carries a `test` block (jsdom environment, globals on). **No setup
      file yet** — nothing needs one until task 8 imports `fake-indexeddb`, which creates it
      and wires `setupFiles` in the same step. `globals: true` costs `vitest/globals` in
      `tsconfig.json`'s `types`.
- [x] `src/tokens.test.ts` asserts the two token files are identical, so a drift is a test
      failure rather than a silent design bug.

**Verification:** `bun run test` runs and passes; `bun dev` serves a page whose background is
`--color-paper`.

**Dependencies:** 1. **Scope:** S.

### Task 3: Shared types

**Description:** `src/types/` — `Session`, `Player`, `Round` (from `data-model.md`),
`Template`, `Category` (from `template-grammar.md`). Transcribed, not invented.

**Acceptance criteria:**
- [x] One file per concern, named exports, no barrel, no `any`.
- [x] Field-for-field match with the spec, optional fields included
      (`targetScore`, `tiebreakNote`, `handTotal`, `entry`, `finishedAt`).

**Verification:** `bunx tsc --noEmit` clean.

**Dependencies:** 1. **Scope:** XS.

### ✅ Checkpoint A — Foundation
- [x] `bun run build` emits a static bundle, no server entry (**success criterion 1**).
- [x] `bun run test` and `bun run lint` both pass on an empty-ish tree.
- [x] Nothing in `src/` references a database, a server or HeroUI.

---

## Phase 1 — The pure core

Nothing here imports React, the DB, or `features/`. This is the code that can be silently
wrong, so it is written first and tested exhaustively.

### Task 4: Scoring engine

**Description:** `src/lib/scoring.ts` — `cellScore`, `roundScore`, `playerTotal`, `ranking`
with tie detection, exactly as specified.

**Acceptance criteria:**
- [x] `cellScore(v, cat) = Math.floor(v * (cat.multiplier ?? 1) / (cat.divideBy ?? 1))`.
- [x] Missing entries read as `0`; a player with no entries totals `0` and ranks last, never
      "unranked"; an appended empty round contributes `0`.
- [x] `ranking` sorts by `win`, and ties share a rank number carrying a `=` marker.
- [x] Imports nothing but types.

**Verification:**
- [x] `src/lib/scoring.test.ts` covers: integer and negative multipliers, empty entries,
      all-zero ties, `win: "lowest"` ordering, multi-round accumulation, empty appended round.
- [x] **The dedicated regression test: `divideBy: 3` equals `Math.floor(n/3)` for every `n`
      in 0–10000** (**success criterion 3**). This one is non-negotiable and never deleted.

**Dependencies:** 3. **Scope:** S.

### Task 5: Template validation

**Description:** `src/lib/templates/validate.ts` — every rule in `template-grammar.md`.

**Acceptance criteria:**
- [x] Rules covered: `id` matches filename stem; non-empty categories; unique `key`s;
      `players[0] >= 1` and `players[1] >= players[0]`; `multiplier` a non-zero integer;
      `divideBy` a positive integer; `key` matches `^[a-z][a-z0-9_]*$`; `handTotal` a
      non-zero integer and never on a `sheet` template; `entry` is `"player"` or `"team"`.
- [x] Returns a list of problems, not a thrown error — the template test wants all of them.
- [x] Pure: no React, no DB, no `features/`.

**Verification:** `validate.test.ts` has **one failing-case test per rule above**.

**Dependencies:** 3. **Scope:** S.

### Task 6: Board-game templates

**Description:** `src/lib/templates/*.json` for the six sheet-mode games (Catan, Splendor,
Wingspan, Azul, Ticket to Ride, 7 Wonders), plus `registry.ts` importing each JSON directly
(no barrel, no glob).

**Acceptance criteria:**
- [x] JSON transcribed from `template-grammar.md`; no invented category, no float anywhere.
- [x] 7 Wonders coins use `divideBy: 3`, never a fractional multiplier.
- [x] `registry.ts` exports the ordered list the shelf renders.

**Verification:** `templates.test.ts` iterates **every** registered template, asserts it
validates, and asserts a hand-checked fixture scores to a known total. A template without a
fixture fails the suite.

**Dependencies:** 4, 5. **Scope:** M.

### Task 7: Card-game templates and counter

**Description:** The four tally games (Uno, Belote, Whist, Black Lady) plus `counter.json`.

**Acceptance criteria:**
- [x] `belote.json` and `whist.json` carry `entry: "team"` and their `setupNote`.
- [x] `black-lady.json` carries `handTotal: 26`, `win: "lowest"`, `targetScore: 100`.
- [x] `counter.json`: `tally`, one category, no `targetScore`, `players: [1, 12]`.
- [x] Each template states its encoded variant in `setupNote` or `hint`.

**Verification:** The same iterating test now covers eleven templates, including a
**multi-round Belote fixture** and a **`win: "lowest"` Black Lady fixture**
(**success criterion 2**). Note that `SPEC.md`'s criterion 2 still says "all ten seed
templates (6 board, 4 card)" — `counter.json` makes eleven, and the suite covers all of
them. The criterion's count is stale, not the suite's.

**Dependencies:** 6. **Scope:** M.

### ✅ Checkpoint B — Core
- [x] Success criteria 2 and 3 are green in CI.
- [x] `scoring.ts` and `validate.ts` import nothing but types — now asserted by a test in
      each module's suite rather than read by hand, since no linter enforces it. Verified by
      adding a React import to `scoring.ts` and watching it fail.

---

## Phase 2 — Persistence

### Task 8: IndexedDB module

**Description:** `src/lib/db.ts` — open `bgc` with the `sessions` and `meta` object stores,
hold `schemaVersion`, run ordered migrations on open (v1 ships version 1 and zero
migrations), and expose typed get/put/delete/getAll plus `meta` accessors.

**Acceptance criteria:**
- [x] Exactly two object stores, keyPaths `id` and `key`.
- [x] `meta` keys supported: `schemaVersion`, `recentNames` (capped 20), `lastExportedAt`,
      `locale`, `theme`. **Absent means untouched** — never write a default on open.
      *Scope corrected against `data-model.md`:* that rule covers `locale` and `theme`, "the
      last two are the only settings the app has". `schemaVersion` is bookkeeping and **is**
      stamped at database creation — without it, a database created by a future v3 app would
      hold no version, and the next open would assume v1 and re-run migrations over current
      data.
- [x] A migration runner exists and is a no-op at version 1.
- [x] No `any`; a failed open surfaces an error rather than resolving to an empty store.

**Verification:** `db.test.ts` — session write → reload → identical read; a 15-round tally
session round-trips; the migration runner fires when the stored version is lower.

**Dependency:** `fake-indexeddb` as a devDependency — **approved 2026-08-19**, and the only
dependency this plan adds. jsdom has no IndexedDB; it is imported in the vitest setup file
and nowhere in `src/`.

**Dependencies:** 3. **Scope:** S.

### Task 9: Session store

**Description:** `src/lib/sessions.ts` — create, read, list, update, delete, `duplicateSession`
— over `lib/db.ts`, plus the module that holds loaded sessions and a `useSessions` hook built
on `useSyncExternalStore`. **In `lib/`, not in a feature** (decision 6): both features write
sessions, and this is what stops the cross-feature import.

**Acceptance criteria:**
- [x] `create` snapshots `categories`, `win`, `targetScore`, `tiebreakNote`, `handTotal` and
      `entry` from the template. **A later template edit can never move a played score.**
- [x] `duplicate` copies `templateId`, the snapshot and `players` (names + `colorIndex`),
      with a new `id`, new `createdAt`, `status: "active"` and empty `rounds`.
- [x] `duplicateSession` names the copy with a numeric suffix — `Belote 12 Apr` →
      `Belote 12 Apr (2)`, incrementing past an existing `(2)` — with no prompt. Renaming
      afterwards is the ⋯ menu's job (task 22).
- [x] Every write persists immediately. There is no save action and no flush.
- [x] Imports `lib/db.ts` and types only. No React beyond the hook, no `features/`.

**Verification:** A test creating a session from a template, mutating a cell, reloading the
store from IndexedDB and reading the same value back.

**`updatedAt` added to `Session` (approved 2026-08-20).** `SPEC.md` §Home orders active
sessions "most recently touched first" and stamps each row with a relative time, and neither
is expressible from `createdAt` — resuming last week's game has to lift it to the top.
`data-model.md` is updated; `lib/sessions.ts` is the only writer, so it cannot drift.
Task 12 sorts on it.

**Dependencies:** 8, 7. **Scope:** M.

---

## Phase 3 — Shell and Home

### Task 10: App shell

**Description:** `app/provider.tsx` (theme + locale, both OS-defaulted, persisted to `meta`
only once touched, theme applied as `data-theme` on the document element), `app/router.tsx`,
and `src/routes.ts` registering all six routes with placeholder pages.

**Acceptance criteria:**
- [x] Routes: `/`, `/new`, `/new/players`, `/session/$id`, `/session/$id/history`,
      `/session/$id/results`.
- [x] Untouched install follows `navigator.language` and `prefers-color-scheme`; a touched
      setting survives reload (**success criterion 14**).
- [x] Shared `ScreenHeader` and `Eyebrow` components, token-driven, 52px and 44px bands.
      52 comes from `--h-primary` — the bundle has no separate header token, and the band
      and the primary button are the same height by design.
- [x] Paraglide's strategy becomes `["globalVariable", "preferredLanguage", "baseLocale"]`.
      The scaffold's `url` strategy contradicted the spec: locale lives in `meta`, not in a
      path, and one of the six routes is a session id.

**Verification:** Toggle both settings, reload, values hold; clear `meta`, reload, OS wins.

**Dependencies:** 9. **Scope:** M.

### Task 11: Home — first run (`1e`)

**Description:** The empty state: tally-of-five mark at 72, `Nothing scored yet`, one line of
copy, the eyebrow `NO ACCOUNT · NO SERVER · WORKS OFFLINE`, and a footer carrying
`New game` **and** `Import a backup`.

**Acceptance criteria:**
- [x] Renders when zero sessions exist. No onboarding carousel, no dialog.
- [x] `New game` routes to `/new`.
- [x] Fits 390 × 844 in French — the French strings render and the layout has no fixed
      heights outside tokens. **The actual 390 × 844 fit is not asserted here:** jsdom has
      no layout engine, so it is task 32's job with a real viewport.

**Verification:** Component test on an empty store; visual check against `1e`.

**Dependencies:** 10. **Scope:** S.

### Task 12: Home — populated list (`1d`)

**Description:** `IN PROGRESS` eyebrow → active sessions most-recently-touched first →
`FINISHED · N` → finished sessions. Never re-sorted by game or name.

**Acceptance criteria:**
- [x] In-progress row: game name + `SHEET`/`TALLY` badge; session name · `hand N` or
      `category N of M`; the standing line (`512 – 468`, with `of 501` in ink-soft when the
      snapshot has a `targetScore`); relative time; `Resume →`.
- [x] Finished row: game name; `session · winner · score`; relative time; chevron.
- [x] Rows route to `/session/$id`, or to `/session/$id/results` when finished.
- [x] Relative time is a shared util in `src/utils/` with its own test (`20 MIN AGO`,
      `4 DAYS AGO`, `NEVER`).

**Verification:** Test with a fixture of both statuses; the list is the only scrolling
surface on the screen.

*Note:* the artboard's row uses 10 / 14 / 15px type, none of which is on `tokens.css`'s
scale (11 / 13 / 16 / 17 / 18 / 22 / 26 / 28 / 44). The build snaps to the nearest token,
since `tokens.css` is the normative artifact and a literal size in a component is a bug.
Owed to the designer.

**Dependencies:** 11. **Scope:** M.

### Task 13: Row actions — delete and duplicate

**Description:** Swipe a row left to reveal `Delete` (alarm fill) and `Duplicate`, per
decision 4 above. No per-row bin icon anywhere.

**Acceptance criteria:**
- [x] Delete opens **the app's one confirmation dialog**; duplicate acts immediately, with no
      rename prompt, and the new active session appears at the top of the list.
- [x] The actions are reachable without the gesture (keyboard/AT), since the pane is a real
      scroll container with real buttons.

**Verification:** Test: duplicate produces a session with the same players and colour
indices, a new `id`, empty `rounds` and a `(2)` suffix; duplicating twice yields `(3)`, not a
second `(2)`. Delete confirms before removing.

**Dependencies:** 12, 9. **Scope:** S.

### Task 14: Backup card, export and import

**Description:** The card lives **in the list**, not behind a settings screen: `BACKUP`
eyebrow, relative `meta.lastExportedAt` (`NEVER` when unset, `--color-advisory` past 14
days), a line counting the games that live on this phone only, then `Export` and `Import`.

**Acceptance criteria:**
- [x] Export writes a JSON file of all sessions and sets `meta.lastExportedAt`.
- [x] Import accepts the same format and **merges by `id`, skipping duplicates**.
- [x] **Import validates entry values at the boundary.** A backup file is untrusted input:
      `scoring.ts` resolves a non-numeric entry to zero so nothing downstream sees `NaN`,
      but silently zeroing a corrupted score is a worse outcome than refusing the file.
      Rejecting it is import's job, not the scoring core's.
- [x] Import is reachable from the first-run footer too (task 11).

**Verification:** **Success criterion 5** — export → wipe IndexedDB → import → all sessions
restored byte-identical, as an automated round-trip test over the store.

**Dependencies:** 13. **Scope:** M.

### ✅ Checkpoint C — Home
- [x] Home renders both states, resumes, deletes, duplicates and round-trips a backup —
      each one asserted, `SessionList.test.tsx`, `SwipeRow.test.tsx` and `backup.test.ts`
      ("restores every session byte-identically" is **success criterion 5**).
- [x] `bun run test` (319), `bun run lint`, `bunx tsc --noEmit` and `bun run build` all clean;
      `dist/` still holds only `client/`, no server entry. **The comparison against `1d` and
      `1e` is still owed to a human** — jsdom has no layout engine and nothing here asserts a
      pixel.

**The five-axis review found four real holes, all fixed here:**

1. **The language chip changed nothing on screen.** `babel-plugin-react-compiler` caches
   every `m.*()` call for the life of a component instance — the call takes no reactive
   input — so a re-render reuses the string it computed first. Compounding it, the provider
   set Paraglide's locale in an effect, a render *after* the one it should have changed.
   Fixed on both counts: the locale is applied at the moment of the tap, and the tree is
   keyed on it so the cache is dropped. Regression test in `provider.test.tsx`. **Task 29
   inherits this**: any later message call is safe, but re-passing `locale` per call is not
   the fix and would be a whole-tree diff.
2. **Import silently zeroed a corrupted cell**, which is exactly what task 14 says not to do
   — the shared `sessionSchema` carries `.catch(0)` for the storage path. `importedSessionSchema`
   is the strict one; the test that asserted the zero now asserts the rejection.
3. **Three feature components imported `@/app/provider`**, which is the import graph
   backwards. The context moved to `src/hooks/useSettings.ts`; the app layer keeps the
   provider that owns the state.
4. **Export could fail silently in Firefox** — a detached anchor, and the blob URL revoked in
   the same task as the click. Now appended, clicked, removed, revoked a tick later. The file
   input is also cleared after each pick, so retrying a corrected file actually re-fires.

Two left as notes, not changes: `HomeHeader`'s wordmark carries a literal `tracking-[-0.01em]`
that is not on the token scale (owed to the designer with the rest of the `1d` type sizes),
and `InProgressRow`'s standing line joins every total without truncating — fine at `1d`'s
player counts, a task 32 question at twelve.

---

## Phase 4 — Creating a session

### Task 15: Game picker (`1f`, `1g`)

**Description:** Header, 48px filter field, two-up tile grid at 12px gaps / 16px gutters.

**Acceptance criteria:**
- [x] Tile art is **generated**: `--color-paper-dim` field with a hairline carrying the name
      set like a box spine (uppercase, `--text-screen`, `--tracking-wordmark`,
      `--color-ink-soft`). One treatment for all tiles, no per-game hue, no image assets.
- [x] Meta line derived from the template: `{n} categories · {min}–{max}` for sheet,
      `to {targetScore} · {min}–{max}` for tally, `to {targetScore} · 2 teams` when
      `entry` is `"team"`.
- [x] No-match state shows `Clear filter`. **No `Add a custom game` button** — it is cut.
      *Note:* `1g`'s footer slot is not an authoring button but `Score "krib" with no
      template`, which the counter tile now covers. Not built; owed to the designer.
- [x] The art field is a self-contained component so real box art is a later swap inside it.

**Verification:** Filter to no match, clear, all tiles return in one tap. Tapping a tile
routes to `/new/players` carrying `templateId`. *All asserted in `GameShelf.test.tsx`; the
id travels as a search param, so a reload keeps the chosen game.*

*Note:* eleven tiles is one grid row more than `1f` was drawn for. The row came out of the
art field (64 → 48) rather than out of the shelf, so the screen still fits 390 × 844. The
grid carries an `overflow-y-auto` safety valve for shorter viewports, where clipping the
last row out of reach would be worse than a scroll. Owed to the designer.

- [x] **The shelf shows all eleven templates, counter included**, and the filter placeholder
      is `Filter {n} games` with the count derived from the registry length — decided
      2026-08-19, so the copy cannot drift when a twelfth template lands. `1f`'s literal
      "ten" is superseded.

**Dependencies:** 10, 7. **Scope:** M.

### Task 16: Player setup rows (`1h`)

**Description:** Header (title + `game · min to max`, right-aligned `n / max`), 48px rows,
`PLAYED RECENTLY` pills, pinned 52px primary.

**Acceptance criteria:**
- [x] Title is `Players` / `Teams` (`Équipes`) driven by `entry`; a team template's
      `setupNote` renders as an info banner above the rows.
- [x] Row: colour token · name input · **visible grip handle** for reorder · `×` to remove.
      Reorder is the handle, never a hidden long-press. **`@dnd-kit/core` + `@dnd-kit/sortable`
      approved 2026-08-20** over react-dnd, which needs a second package for touch, was last
      published in 2022 and has no keyboard path. The grip carries the sensors, so one handle
      serves a thumb, a mouse and the arrow keys. Row order follows `1h` (grip first).
- [x] Dashed `Add a player` row beneath, hidden at the template's maximum.
- [x] `PLAYED RECENTLY` renders tap-to-add pills from `meta.recentNames` — **44px, not the
      artboard's 40**: the thumb floor is a contract, and task 32 asserts it.
- [x] Colours are handed out **in palette order** as players are added, and a colour freed
      by a removed row is reused before the palette advances.

**Verification:** Four pills = a four-player table in four taps — asserted, and it holds
because a pill fills the first empty row before it adds one. Reordering rewrites order and
nothing else, asserted over the pure row helpers.

*Note:* rows are `--h-cell` (48) per `SPEC.md` rather than `1h`'s 60, and the body carries an
`overflow-y-auto` safety valve — twelve counter players plus the recent block do not fit 844
at any row height. Owed to the designer.

**Dependencies:** 15. **Scope:** M.

### Task 17: BottomSheet and colour sheet

**Description:** The shared `BottomSheet` (decision 3) and the colour picker on top of it.

**Acceptance criteria:**
- [x] Sheet: `--radius-card` on top corners only, `--shadow-sheet`, `--scrim` behind,
      `--dur-sheet` 200ms with `--ease`, dismissed by swipe-down or backdrop tap.
- [x] Colour sheet: header (token, `Marie's colour`, `×`), a 4 × 3 grid of 56px swatches each
      carrying **its index number and letter**, one line of copy about the initial. `1h` draws
      6 × 2 at 48px with the letter only; **the spec's grid was chosen 2026-08-20** — bigger
      targets, and the index is what the database stores. Owed to the designer.
- [x] Taken colours dim to 32% and are **non-selectable — they dim, never disappear**, so the
      grid cannot reflow under a thumb. Selected takes a 2px ink ring.
- [x] Never a dropdown.

**Verification:** Component test — a taken colour refuses selection and the grid keeps its
twelve positions. The sheet's own suite covers all three ways out (×, scrim, Esc) and found a
real defect: the scrim path started the exit animation without setting the flag its listener
reads, so a sheet dismissed by tapping outside animated away and never unmounted.

**Dependencies:** 16. **Scope:** M.

### Task 18: Setup validation and session creation (`1i`)

**Description:** Blocking validation and the write that starts the game.

**Acceptance criteria:**
- [x] Blocking is **stated twice**: the primary dims *and* a plain auto-height line beneath
      it says why, in `--color-alarm-ink` on `--color-alarm-bg`. Never a toast, never a pill.
- [x] Rules: player count inside the template range; names non-empty and unique within the
      session (the drawn case is duplicate team names). One reason at a time, count first.
      Uniqueness is case-insensitive and trimmed — two rows called `Marie` and ` marie ` carry
      the same token and the same initial.
- [x] On continue: create the session with its snapshot, call `navigator.storage.persist()`
      if not yet granted and **log the boolean result** (**success criterion 8**), write
      `recentNames`, route to `/session/$id`. The persist call is deliberately not awaited into
      the navigation: a slow permission prompt must not stand between somebody and the first
      hand.

**Verification:** Two identically-named teams block, asserted, with `1i`'s French copy in
`messages/fr.json`. The banner is auto-height and asserted to carry no fixed height — at
`--text-meta` (13), since 14 is not on the token scale and a literal size in a component is a
bug. Owed to the designer.

**Dependencies:** 17, 9. **Scope:** S.

### ✅ Checkpoint D — A session can be born
- [x] Home → picker → setup → a persisted session, offline, in French — one walk through
      the **real route tree** in `src/routes/newSession.flow.test.tsx`: first run in French,
      the shelf counting its own eleven games, `1i`'s duplicate-team block in French, then a
      Belote session in IndexedDB with the template snapshotted and both names in
      `meta.recentNames`. A second test walks the same path with `fetch` and
      `XMLHttpRequest` stubbed and asserts **neither is ever called**.
- [ ] **No scroll anywhere is not asserted** — jsdom has no layout engine, so this is
      arithmetic, not measurement, and task 32 owns the real check at 390 × 844:

      | Screen | Worst legal case | Content height |
      |---|---|---|
      | Picker | 11 tiles, 6 rows | 52 + 62 + 660 + 20 = **794** |
      | Setup | 12 counter rows, all named | 52 + 576 + 86 = **714** |
      | Setup | 12 rows, none named (transient) | + banner + recent block ≈ **866** |

      Against 800 (844 less the status band). The last row is why both screens keep an
      `overflow-y-auto` safety valve: clipping a row out of reach is worse than a scroll.

**The review found four defects, all fixed in `7d92035`:** picking a colour unmounted an open
modal `<dialog>`, skipping `--dur-sheet` and dropping focus instead of returning it to the
token that opened the sheet; taken swatches were `disabled`, so the grid that deliberately
never reflows was invisible to the keyboard; the tile's generated art repeated the game name
into the accessible name (`Wingspan Wingspan sheet…`); and the palette index sat at 80%
opacity, where `--player-ink` no longer clears 4.5:1.

`PLAYED RECENTLY` now hides rather than dims when the table is full and named. The pills can
do nothing at that point, and the ~92px they occupy is exactly what a twelve-player counter
needs to fit 844.

---

## Phase 5 — Sheet mode

### Task 19: Keypad

**Description:** The shared 3 × 4 keypad (`1–9`, `±`, `0`, `⌫`) — no `<input>`, ever.

**Acceptance criteria:**
- [x] 60px keys at 8px gaps, digits at 26 on card fill, utilities on `--color-paper-dim`.
- [x] `±` toggles sign on any value shape including empty and `0`; `⌫` removes one digit and
      returns to the empty state, not to `0`. Writing the test settled a rule the task left
      open: `⌫` on `-4` leaves `-`, not `""` — the sign was typed deliberately, it is the same
      state `±` produces on an empty cell, and one press should never delete two things.
- [x] Key size and the action row clear 44px.

**Verification:** Component test walking `±` and `⌫` over every value shape — this is one of
the three surfaces where a mis-tap costs data. The rules are a pure module
(`utils/keypadValue.ts`) with a case per shape; the component test walks them through real
taps. Five digits is the cap: past any seed template's score, and it keeps the readout on
one line.

**Dependencies:** 10. **Scope:** S.

### Task 20: Sheet screen (`1c`, `1k`)

**Description:** The read side: header, category strip, category head, seven 72px rows,
footer with pager dots.

**Acceptance criteria:**
- [x] **Chip text = first three letters of the *translated* label, uppercased**; if two
      collide within a template, both fall back to their 1-based index. Chip states:
      done = `--color-paper-dim` + ✓, current = accent fill + `●`, future = card + hairline.
      Any chip is tappable to revisit its category.
- [x] Row: 28px token with initial · name at 17 · mono 11 `<total> SO FAR · <ordinal>` with
      `=` on a tie · right-aligned 64×48 cell in its empty/filled/focused states. Ordinals are
      a tested util — `1st/2nd/3rd`, `1er/2e` — not a suffix table written twice.
- [x] Empty cell renders an em-dash in `--color-ink-faint` and scores 0, and is **absent**
      from the round rather than stored as zero, so Results can still warn about it.
- [x] Dark (`1k`) is the same structure; the accent primary uses `.btn-primary` so dark
      accent carries ink, not paper.

**Verification:** 7 players × 7 categories in French fits 390 × 844 with no frame scroll.
The abbreviation function has its own unit test including the collision fallback.

**Dependencies:** 19, 9. **Scope:** M.

### Task 21: Sheet entry (`1j`)

**Description:** The keypad sheet and the write path.

**Acceptance criteria:**
- [x] Sheet header: active player's token, name, mono status line (`BIRDS · 45 SO FAR`),
      live value with a 2px accent caret. **The keypad is not a modal sheet:** it takes the
      sheet's treatment but no scrim and no inertness, because `1j` draws the rows behind it
      at full strength on purpose — every number sits beside its peers, and that peer check is
      how a typo is caught. A departure from `SPEC.md`'s blanket "bottom sheets … `--scrim`
      behind", following the artboard and its stated rationale.
- [x] Action row: `Clear` (96px secondary) and a primary **naming the next player**
      (`Next — Dan →`), which names the next *category* once the column is walked, so the
      button always says where the phone is going.
- [x] Every keystroke recomputes value, running total and rank *label*. **Rows never
      reorder** — asserted with a score that puts seat one into the lead.
- [x] Every cell change persists immediately; there is no save action. **This is where the
      phase's real bug was:** patching `rounds` wholesale from the last render meant two cells
      entered in quick succession were both built from one snapshot, and the second erased the
      first. `lib/sessions.setCell` re-reads the session inside the serialised write.
- [x] Footer primary reads `Next category →`, and `See results →` on the last category.

**Verification:** **Success criterion 6** — a full 4-player Wingspan sheet (24 cells)
completes without losing focus, reordering rows or requiring a save.

**Dependencies:** 20. **Scope:** M.

### Task 22: The ⋯ menu

**Description:** Rename session, add a late player, finish game — shared by both modes; tally
adds hand history. Built once, here.

**Acceptance criteria:**
- [x] Rename edits `name` in place; add-a-late-player appends with the next palette colour
      and a new `sortOrder`, and existing rounds simply have no entry for them (reads as 0).
      The cap is the palette, not the template's range — a late player is by definition
      outside it.
- [x] Finish sets `status: "finished"` and `finishedAt`, then routes to Results.
- [x] Lives in `features/scoresheet/components/`, imports no session-feature module. The
      game-name lookup Home also needs moved to `utils/gameName.ts` rather than becoming a
      cross-feature import.

**Verification:** Adding a 5th player mid-sheet leaves all four existing columns untouched —
this is the test that caught the lost-cell bug above.

**Dependencies:** 21. **Scope:** S.

### ✅ Checkpoint E — Sheet mode end to end
- [x] **Criterion 6, and criterion 4 as far as jsdom can carry it.**
      `src/routes/sheetGame.flow.test.tsx` walks the real route tree: Home → picker → four
      players → **all 24 cells of a 4-player Wingspan sheet** without the keypad closing
      between players → finish from ⋯ → a reload (store dropped, database reopened) → every
      one of the 24 values read back, in seat order, `status: "finished"`. `fetch`,
      `XMLHttpRequest`, `WebSocket`, `EventSource` and `sendBeacon` are all stubbed for the
      whole walk and **none is ever called**.
- [x] The shipped bundle carries **no network API at all** — `fetch(`, `XMLHttpRequest`,
      `WebSocket`, `EventSource` and `sendBeacon` appear zero times across the 13 JS chunks
      in `dist/client`. The only URLs in the bundle are JSON-schema identifiers, XML
      namespaces and error-doc links, all of them strings.
- [ ] **The devtools half is still owed**: offline from first paint, on a real origin, with
      the network panel recording. That is task 31's re-verification against the deployed
      URL, and it needs a browser this environment does not have.

**The review found two defects, both fixed in `358ba52`:**

1. **The last category's primary was `disabled`.** It read `See results →` and did nothing,
   so the only way off the end of the sheet was ⋯ → Finish, which also *ends the game* —
   something `See results` is explicitly not supposed to do. The screen's own test asserted
   the button existed and never that it worked.
2. **The row being typed into could sit behind the keypad.** The panel takes the bottom half
   of the screen, and at seven players the focused row is usually under it. Rows now scroll
   into view on focus: typing into a cell you cannot see is how the wrong row gets scored.

Writing the 24-cell walk also surfaced a third: the cell rendered the **stored** value, so it
lagged the keystroke by a database round trip. Imperceptible on a phone, but the cell is where
the person typing is looking — the focused cell now renders what is being typed and the rest
render what is stored.

---

## Phase 6 — Tally mode

### Task 23: Tally utilities

**Description:** `features/scoresheet/utils/` — density tier, rank and tie labelling,
race-bar fraction, `toGo`, hand-balance check. Pure functions over plain data, nothing
stored.

**Acceptance criteria:**
- [x] `density = players <= 3 ? "roomy" : players <= 6 ? "comfortable" : "compact"`, derived
      at render time, never persisted, never a preference.
- [x] `racebar = clamp(total / targetScore, 0, 1)`; progress when `win: "highest"`, distance
      to bust when `"lowest"` — the same fraction either way, and the colour says which.
- [x] `handBalance(r)` sums the round against `handTotal` and **returns a number, not a
      verdict** — nothing in this module can block a save. Signed: 0 balanced, negative with
      points unplaced, positive when the moon is shot. It scores each cell through
      `roundScore` first, so a multiplier is respected.

**Verification:** Boundary tests at 3→4 and 6→7 players; a tie yields the same rank and a `=`
on both — all in `features/scoresheet/utils/tally.test.ts`.

**Two shapes the task left open, settled by writing the tests:**

1. **`toGo` and `racebarFraction` return `undefined` without a `targetScore`, not zero.**
   `counter.json` has no target, and a zero would draw an empty race bar and a `0 to go`
   line for a game that has nowhere to go. This is the one place the codebase's
   "missing data resolves to a defined zero" rule does not apply: the target is not missing
   data, it is a template that has none.
2. **`standings` reuses `lib/scoring.ranking` and re-sorts into seat order** rather than
   deriving rank a second time. Rank and the `=` marker have exactly one implementation, and
   the "rows never re-sort" rule is asserted here as well as in tasks 20 and 28.

**Dependencies:** 4. **Scope:** S.

### Task 24: Standings (`2a`, `2b`, `2e`)

**Description:** One row per player, three density tiers, one layout.

**Acceptance criteria:**
- [ ] Row heights 132 / 102 / 62 with the totals at 52 / 38 / 26 — **the total never drops
      below 26**. Shed order as the table grows: hands-won clause, then inline ledger, then
      the row's second line.
- [ ] Rows are in **seat order**; rank is a mono number in the margin and never sorts.
- [ ] `LEADS` pill for rank 1, hidden at `opacity: 0` for everyone else so the name baseline
      never shifts. `win: "lowest"` makes rank 1 the lowest total and the pill reads `SAFEST`.
- [ ] Recap line: mono 10 `HAND 14 · CHLOÉ TOOK 60` with `EDIT LAST` in accent at the right.
- [ ] Entry bar (~106, pinned): 60px accent `Enter hand N →`, 20px bottom safe padding, in
      the same place at hand 1 and hand 40.
- [ ] **Target passed** renders one mono advisory line above the entry button and **changes
      no state** — never a dialog, never an automatic end.

**Verification:** 10 players fits 844 exactly with no scroll; 12 scrolls a row or two.
**Success criterion 10** for both counts, in French.

**Dependencies:** 23, 19. **Scope:** M.

### Task 25: Entry sheet (`2c`)

**Description:** One sheet walks the table.

**Acceptance criteria:**
- [ ] Contents in order: 36 × 4 grab handle; active-player header (30px token, name 17/600,
      mono status line, live value at 38 with a 2px accent caret); player strip; 52px keypad
      at 7px gaps; actions.
- [ ] The player strip is **progress indicator and random access** — tapping any tile jumps
      to that player. Active = accent border on lifted fill; entered = card fill with the
      value; untouched = dim fill with an ink-faint em-dash. At 10+ players tiles drop the
      token and keep the number.
- [ ] Actions: `Clear` (88px secondary) and a primary **naming the next player**; the last
      hand-over saves the hand and dismisses the sheet.
- [ ] With `handTotal` set, the header renders the live check
      (`MANCHE 9 · 26 À RÉPARTIR · 7 PLACÉS`) in `--color-advisory-ink`. Templates without
      one render no clause.
- [ ] **The hand saves regardless of balance.** Shooting the moon is legal play.

**Verification:** **Success criterion 12** — a 10-player Uno hand entered end to end without
dismissing the sheet, and jumping back to player 3 mid-hand preserves players 4–9. Plus the
behaviour test asserting the advisory counter and the save path are **separately** tested, so
nobody re-couples them.

**Dependencies:** 24. **Scope:** M.

### Task 26: Inline ledger at ≤ 3 players (`2e`)

**Description:** The last six hands under the standings when the table is small enough for
the height to be worth something.

**Acceptance criteria:**
- [ ] Mono column head (`HAND | MARIE & LUC | SOFIA & TOM`), 46px rows carrying the hand
      score at 19 and the running total in mono 12.
- [ ] **Oldest above newest, anchored to the foot** so the newest hand sits against the entry
      bar.
- [ ] Disappears at four players — one conditional block, same screen, same entry sheet.

**Verification:** A 2-team Belote session shows six hands and still fits 844.

**Dependencies:** 25. **Scope:** S.

### Task 27: Hand history (`2d`)

**Description:** The audit screen, reached from ⋯.

**Acceptance criteria:**
- [ ] Segmented `Per hand | Running` (42px, ink fill on the active half); column head of 24px
      tokens on `--color-paper-dim` with a 2px bottom rule; 56px hand rows; pinned `TOTAL`
      row (62) on card fill; footer strip.
- [ ] Columns 44px + 60px per player, so the sixth column **deliberately bleeds past the
      right edge**. This is the only screen besides Home that scrolls, and the only one that
      scrolls horizontally.
- [ ] Zeros render as a faint interpunct `·`.
- [ ] Cells are tappable for correction and totals recompute live.

**Verification:** **Success criterion 7** — a 15-hand Belote session accumulates correctly,
persists every hand, and force-quitting after hand 12 loses nothing.

**Dependencies:** 26. **Scope:** M.

### ✅ Checkpoint F — Tally mode end to end
- [ ] Belote to 501 and 10-player Uno both play through, offline, without a scroll on the
      standings and without a dialog anywhere.

---

## Phase 7 — Results

### Task 28: Results (`1n`, `1o`)

**Description:** The one moment sorting is allowed.

**Acceptance criteria:**
- [ ] Winner card: card fill, 1px accent border. **One winner block however many winners** —
      tied players share the block (`JOINT WINNERS`, overlapping tokens, `Chloé and Émile`),
      share the rank number, and carry `=` down the list.
- [ ] Tiebreak card appears only when ranks tie **and** the snapshot has a `tiebreakNote`:
      eyebrow `TIEBREAK · {game}`, the note, and a line saying out loud that the app will not
      apply it. **A tie stays a tie** — no resolve button, no coin prompt, no confetti.
- [ ] Ranked rows at 46px; per-category or per-hand takeaways in mono 11 beneath.
- [ ] An empty cell anywhere produces an **advisory** warning, never a block.
- [ ] Footer: a three-up row of `Play again` · `Reopen` · `Export` at `--h-tap`, then
      `Back to games` full width. `Reopen` returns the session to `active` and clears
      `finishedAt` in one tap. **`Play again` calls the same `duplicateSession` as Home's
      swipe action** (task 9) and routes to the new session, leaving the finished one
      untouched.
- [ ] The three-up row is an **approved departure from `1n` / `1o`**, recorded in `SPEC.md`
      §7. Check the French fit (`Rejouer` / `Rouvrir` / `Exporter` at ~111px) against 390px
      before building; if it forces a fourth band, the band heights give way, not the button.

**Verification:** A hand-built tie fixture renders one shared block, one shared rank and two
`=` markers, and nothing in the code path picks a winner. `Play again` produces a new active
session and leaves the finished one's `status` and `rounds` untouched.

**Dependencies:** 22, 27. **Scope:** M.

---

## Phase 8 — Ship

### Task 29: French pass

**Description:** Every string through Paraglide, and the layout audit the spec calls a
constraint rather than a translation.

**Acceptance criteria:**
- [ ] No literal user-facing string left in a component.
- [ ] `EN`/`FR` chip in the Home header switches without reload and persists to `meta`.
- [ ] **Every container is sized for the French string.** Validation banners and buttons are
      auto-height at 14px/1.45 — never fixed-height pills.

**Verification:** Every screen rendered in French at its worst-case player count.

**Dependencies:** 28. **Scope:** M.

### Task 30: PWA

**Description:** Manifest, icon, service worker, installability.

**Acceptance criteria:**
- [ ] The app icon from `1p` — a tally of five, diagonal, in accent, `--radius-tile` —
      exported at the manifest's sizes. The only asset that ships.
- [ ] Manifest colours come from `tokens.css`; a service worker caches the static bundle.
- [ ] Add-to-Home-Screen is prompted, per the durability mitigation.

**Verification:** **Success criterion 9** — installable, valid manifest, offline cold start
after install.

**Dependencies:** 29. **Scope:** M.

### Task 31: Deploy to GitHub Pages

**Description:** Publish the static bundle to GitHub Pages from CI, so the PWA is installed
and tested from a real HTTPS origin rather than `localhost`. The repo is
`Gravill0n/scorepad`, so the site is a **project page** at
`https://gravill0n.github.io/scorepad/` and everything below follows from that
sub-path.

**Acceptance criteria:**
- [ ] `vite.config.ts` sets `base: "/scorepad/"` (via `BASE_PATH` env with `/` as
      the local default, so `bun dev` is unaffected).
- [ ] The router takes its `basepath` from `import.meta.env.BASE_URL` — never a hardcoded
      string in two places.
- [ ] **SPA deep links work.** GitHub Pages has no rewrite rule, so `/session/abc` 404s on a
      hard reload. Fix: copy `index.html` to `404.html` as a build step. That is the whole
      mechanism — no hash router, no redirect shim, no dependency.
- [ ] Task 30's manifest and service worker are re-checked against the sub-path: `start_url`
      and `scope` are `/scorepad/`, icon paths are relative, and the SW registers
      with the same scope. A root-scoped SW silently fails to control the page here.
- [ ] A GitHub Actions workflow (`.github/workflows/deploy.yml`) on push to `main`:
      `bun install --frozen-lockfile` → `bun run lint` → `bun run test` → `bun run build` →
      `actions/upload-pages-artifact` → `actions/deploy-pages`, with `permissions: pages:
      write, id-token: write`. Official actions only — **no `gh-pages` npm package**.
- [ ] **Lint and tests gate the deploy.** A red suite must not reach the URL people install
      from.
- [ ] Pages is set to "GitHub Actions" as its source in the repo settings (one manual step,
      done once — note it in the README).

**Verification:**
- [ ] The deployed URL loads, and a hard reload on `/scorepad/session/<id>` renders
      the session rather than a 404.
- [ ] **Success criteria 4 and 9 are re-verified against the deployed origin, not
      `localhost`:** install from the URL, go offline from first paint, create → score →
      finish → reload with zero network requests recorded.
- [ ] The build still emits no server entry (**criterion 1**) — Pages cannot serve one, so
      this is now enforced by the host as well as by the config.

**Dependencies:** 30. **Scope:** S (one workflow file, two config lines, one copy step).

**Note:** deploying is the first outward-facing step in this plan — the workflow lands here,
but pushing to `main` and enabling Pages is yours to trigger. If a custom domain arrives
later, `base` goes back to `/` and the manifest scope with it; that is a two-line change,
which is why the path is derived rather than written out.

### Task 32: Contract tests

**Description:** The assertions that catch a refactor or a copy change silently breaking the
design contract.

**Acceptance criteria:**
- [ ] **Every screen renders at 390 × 844 in French at its worst-case player count and does
      not scroll the frame** — 7-player 7 Wonders sheet, 10- and 12-player tally standings,
      the 12-tile entry strip. Only Home and Hand history may scroll.
- [ ] Nothing interactive under 44px; no body type under 16px (**success criterion 13**).
- [ ] `.num` on every recomputing figure.
- [ ] Light and dark both pass 4.5:1 for body text and for every player token with its
      initial (**success criterion 11**).
- [ ] No screenshot or pixel diffing. The artboards are the reference and a human compares.

**Dependencies:** 29. **Scope:** M.

### Task 33: Docs and the success-criteria walkthrough

**Description:** Bring `README.md` and `CLAUDE.md` in line with what shipped, and walk all
fourteen success criteria by hand, recording the result.

**Acceptance criteria:**
- [ ] The architectural rules are stated in `README.md` and `CLAUDE.md` — they are the only
      enforcement the import graph has.
- [ ] Each of the fourteen criteria is marked pass, with the automated ones naming their test.
- [ ] The spec's open questions are updated: the TanStack DB question closed by decision 1,
      the shelf-count question by task 15, and the `Play again` note carried back to the
      designer.
- [ ] `README.md` carries the live URL and the one-time "set Pages source to GitHub Actions"
      step.

**Dependencies:** 31, 32. **Scope:** S.

### ✅ Checkpoint G — Done
- [ ] All fourteen success criteria pass, with 4 and 9 checked on the deployed URL.
- [ ] `bun run lint` and `bun run test` clean, and the deploy workflow is green on `main`.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| TanStack Start's SPA-mode option differs from what the spec assumes | High — criterion 1 is the architecture | Task 1 verifies against the installed version; static prerendering is the documented fallback and the spec sanctions either |
| IndexedDB has no test environment in jsdom | Low, now | `fake-indexeddb` approved (task 8); it is a devDependency and never imported from `src/` |
| 12-player tally standings overflow 844 | Medium — it is the constraint the design was built against | Task 24 builds the shed order first, not last; task 31 automates the check |
| Bespoke swipe/sheet gestures grow into a gesture library | Medium — an unrequested dependency | Decisions 3 and 4 pin both to native platform behaviour; revisit only if a real device fails |
| French copy overflows a container found late | Low, but everywhere | Write French alongside English in each screen task rather than deferring it all to task 29 |
| The Pages sub-path breaks deep links or the service worker scope | Medium — both fail silently, and the SW one only shows up offline | Task 31 pins `base`, the router basepath, the manifest scope and the `404.html` copy together, and re-runs criteria 4 and 9 against the deployed origin |
| A tenth-hour "just sort the rows" | High — it breaks the pass-the-phone model | Seat order is asserted in tasks 20, 24 and 28's tests |

## Decisions taken 2026-08-19

All four questions this plan opened are answered. Nothing here blocks a start.

1. **`fake-indexeddb`** — approved as a devDependency (task 8). The plan's only new
   dependency; the store gets real automated coverage.
2. **The shelf shows eleven tiles**, counter included, with the count derived from the
   registry (task 15). `1f`'s literal "ten" is superseded.
3. **A duplicated session takes a `(2)` suffix**, no prompt (tasks 9 and 13). Renaming stays
   in the ⋯ menu.
4. **`Play again` is reinstated** as a fourth Results action (task 28) — an approved
   departure from `1n` / `1o`, written into `SPEC.md` §7 before this plan was updated.

## Still owed to the designer

Not blockers — messages, not decisions:

- `1f` should lose the literal "ten" from its filter placeholder.
- `1g` should lose the `Add a custom game` button (cut from v1 by the spec).
- `1n` / `1o` gain a fourth footer action; the paired row becomes three-up.
- `tokens.css`'s header comment still cites "HeroUI overrides". HeroUI is cut, and the file
  is copied byte-identically into `src/`, so the stale line is the one thing keeping task
  1's `grep` from returning clean.
