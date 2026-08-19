# Spec: Board Game Counter (v1)

Source of truth for v1. Direction and rationale: `../ideas/scoresheet-first.md`.
Companion specs: [`template-grammar.md`](./template-grammar.md),
[`data-model.md`](./data-model.md).

> **The design pass is done. There is no [UI TBD] left in this spec.** Visual and
> interaction design is fixed by the handoff in
> [`../design_handoff_scorepad/`](../design_handoff_scorepad/README.md) — read its
> `README.md` first, then the artboards in `Scorepad.dc.html`. Artboard ids (`1c`–`1k`,
> `1n`–`1p`, `2a`–`2e`) are stable references; every screen section below cites the one it
> implements. `tokens.css` is used **verbatim** — no token is renamed, re-derived or
> invented here.
>
> Where the handoff prose and an artboard disagree, **the artboard wins** (it is the
> high-fidelity, verified surface). Two such cases are called out inline.

## Objective

Replace hand-kept score with a sheet that already knows the game being played — whether
that means six categories tallied once at the end of Wingspan, or one number per hand
accumulating across fifteen hands of Belote.

**User:** board gamers scoring a finished or in-progress game at the table, on a phone.
**Not:** play-logging, collection management, or statistics. BG Stats does those well;
this competes only on live scoring, where it is weak.

**Success:** the user's own group stops reaching for pen, paper, or a notes app, and
keeps not reaching for them after the novelty wears off.

### Assumptions this spec is built on

1. No accounts, no network requests after page load, in v1.
2. A session is only ever opened on one device — no merge or collision handling exists.
3. Locales are English and French; English is the base.
4. Mobile browser first, installed as a PWA. Desktop works; it is not the design case.
5. For board games the pain is the end-game tally, not live tracking. For card games it is
   the opposite — the running total across hands is the whole point. The grammar serves
   both via `sheet` and `tally` modes; see `template-grammar.md`.

## Tech Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | TanStack Start (React 19), **SPA mode / static prerendering** | Both paths emit a client bundle with no server entry — pick one in task 0 |
| Routing | TanStack Router, virtual file routes (`src/routes.ts`) | |
| Client store | TanStack DB (`@tanstack/react-db`) over IndexedDB | Local adapter availability **unverified** |
| Persistence | IndexedDB | Only store; see `data-model.md` |
| Styling | Tailwind 4 + `tokens.css` (design bundle, pasted as a `@theme` block) | HeroUI dropped — see below |
| i18n | Paraglide (`en`, `fr`) | |
| Test | Vitest | No config block exists yet — must be added |
| Lint/format | Biome 2.4.5 | tabs, double quotes |
| Package manager | Bun | |

**Removed from the stack:** Prisma, `@prisma/adapter-pg`, PostgreSQL, `@faker-js/faker`,
`dotenv-cli`, Nitro server output, all `db:*` scripts, and the `@Server/*` path alias.

**HeroUI (`@heroui/react`, `@heroui/styles`) is dropped too.** Every surface in the
artboards is bespoke — a 60px custom keypad, a swipe-revealed row, a 12-swatch colour
sheet, three density tiers of standings row, a hairline-only elevation model with fixed
heights. Not one of them is a HeroUI primitive worn unmodified, and the library's own
theme layer would have to be fought back to `tokens.css` on every component. Tailwind 4
consuming the `@theme` block directly is strictly less code. `lucide-react` stays — it is
the icon set the artboards' inline SVGs substitute for (stroke 2–2.5, round caps).

**No server output is a supported configuration, not a fight.** TanStack Start ships SPA
mode and static prerendering; either satisfies criterion 1. Task 0 picks one and pins the
config in `vite.config.ts` — prerendering if the ten static routes are worth having as HTML,
plain SPA otherwise. Every route in this app is behind local data, so SPA is the likely
answer and prerendering buys little; decide by trying, not by arguing.

**Fallback:** TanStack DB's local/IndexedDB adapter is still unverified. If it turns out to
be a query-oriented store wearing an offline hat, a hand-written IndexedDB module in
`src/lib/db.ts` is the smaller thing — the data model is two object stores and a version
integer. Nothing currently in use would be lost either way.

## Commands

> ⚠️ `node_modules` is absent in the working tree. **None of these have been executed.**
> Verifying them is task 0.

```
Install:  bun install
Dev:      bun dev                  # vite dev --port 3000
Build:    bun run build            # must emit a static bundle, no server entry
Preview:  bun run preview
Test:     bun test                 # vitest run
Watch:    bunx vitest
Lint:     bun run lint             # biome check .
Fix:      bun run lint:fix         # biome check --write .
Format:   bun run format           # biome format --write .
```

## Project Structure

Follows [bulletproof-react](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md).

```
src/
├── app/                    application layer
│   ├── routes/               *.page.tsx / *.layout.tsx, registered in src/routes.ts
│   ├── provider.tsx          root providers — theme + locale, both OS-defaulted
│   └── router.tsx            router construction
├── components/             shared UI, all token-driven:
│   │                         PlayerToken (colour + initial), Keypad (3×4, 1–9 ± 0 ⌫),
│   │                         BottomSheet (scrim, 200ms, swipe/backdrop dismiss),
│   │                         ValueCell, PrimaryButton, RaceBar, ScreenHeader, Eyebrow
├── config/                 constants (storage keys, caps, density thresholds)
├── features/
│   ├── sessions/             create, list, delete, duplicate, export/import, picker, setup
│   │   ├── api/                IndexedDB reads/writes for sessions
│   │   ├── components/         HomeList, SessionRow (swipe-revealed actions), BackupCard,
│   │   │                       EmptyState, GameTile, PlayerSetupRow, ColourSheet
│   │   ├── hooks/
│   │   └── utils/
│   └── scoresheet/           scoring screens, history and results
│       ├── components/         CategoryStrip, SheetRow, SheetKeypadSheet,
│       │                       StandingsRow, RecapLine, EntrySheet, InlineLedger,
│       │                       HandHistoryGrid, ResultsList, WinnerCard
│       ├── hooks/
│       └── utils/
├── hooks/                  shared hooks (useTheme, useDensity)
├── lib/                    preconfigured reusable libraries
│   ├── db.ts                 IndexedDB open, schema version, migrations
│   ├── scoring.ts            pure scoring engine
│   ├── templates/            *.json seed templates + registry.ts + validate.ts
│   └── i18n.ts               paraglide re-export
├── testing/                test utilities and fixtures
├── types/                  Template, Category, Session, Player, Round
├── utils/                  shared utilities
├── tokens.css              copied verbatim from the design bundle; imported by styles.css
└── paraglide/              generated, gitignored
```

Routes registered in `src/routes.ts`: `/`, `/new`, `/new/players`, `/session/$id`,
`/session/$id/history`, `/session/$id/results`.

Two features, deliberately. Bulletproof-react's structure scales *down* as well as up —
`features/` holds what has its own screens and state, and everything shared sits in
`lib/`, `types/` and `utils/`. Resist a third feature until a third screen group earns it.

### Architectural rules

- **Unidirectional flow:** `shared (components, hooks, lib, types, utils) → features → app`.
  The app layer may import features and shared; features may import shared; shared imports
  neither.
- **No cross-feature imports.** `features/sessions` and `features/scoresheet` must not
  import each other. Anything both need moves to `lib/`, `types/` or `utils/` — which is
  precisely why the scoring engine and template registry live in `lib/` rather than inside
  a feature.
- **No barrel files.** Import JSON and modules directly, per bulletproof-react's
  tree-shaking guidance for Vite.
- **`src/lib/scoring.ts` and `src/lib/templates/validate.ts` must not import React, the DB,
  or anything from `features/`.** Pure functions over plain data — that purity is what
  makes the scoring engine exhaustively testable without a browser.

**Enforcement is convention and review, not tooling.** Biome's `noRestrictedImports`
restricts import *sources* and cannot express a directory-scoped directional rule, and
adding ESLint alongside it to police four bullet points costs more than it saves. The rules
are stated in `CLAUDE.md` and `README.md` so both the humans and the agents read them before
they write an import. Revisit if a violation actually lands — one caught in review is
cheaper than a second linter in the toolchain forever.

Tests are colocated: `scoring.ts` → `scoring.test.ts`.

```
docs/
├── ideas/    direction and rationale
└── spec/     this directory — source of truth
```

## Code Style

Biome-enforced: tabs, double quotes, organised imports. Named exports, arrow-function
consts, `@/` path alias — matching the existing `src/data/queries/gameSessions.ts`.

```ts
import type { Category, Round } from "@/types";

export const cellScore = (value: number, category: Category): number =>
	Math.floor((value * (category.multiplier ?? 1)) / (category.divideBy ?? 1));

export const playerTotal = (
	rounds: Round[],
	playerId: string,
	categories: Category[],
): number =>
	rounds.reduce(
		(total, round) =>
			total +
			categories.reduce(
				(sum, cat) => sum + cellScore(round[playerId]?.[cat.key] ?? 0, cat),
				0,
			),
		0,
	);
```

Conventions: no default exports; `type` for data shapes, `interface` only when extending;
no `any`; missing data resolves to a defined zero rather than `undefined` propagating.

## Design system

Source: `docs/design_handoff_scorepad/tokens.css`, copied to `src/tokens.css` **unchanged**
and imported by `src/styles.css`. The `@theme` block feeds Tailwind 4; the
`[data-theme="dark"]` block is plain CSS and covers everything outside Tailwind's reach.

**Non-negotiable contracts** (these are correctness, not taste — the phone is read across
a table, not at a desk):

| Contract | Value |
|---|---|
| Body type floor | 16px (`--text-body`). Never 14 |
| Interactive height floor | 44px (`--h-tap`) |
| Any figure that recomputes | `font-variant-numeric: tabular-nums` (the `.num` class) |
| Elevation | 1px `--color-line` hairlines only. `--shadow-sheet` exists for bottom sheets and nothing else |
| Signal colours | exactly two: accent `--color-accent`, alarm `--color-alarm`. `--color-advisory` is the third tier and is never a *signal* — it is a note |
| Frame | designed at 390 × 844; every screen fits its content in 844px without scrolling the frame. Only two surfaces scroll: the Home list and Hand history |

**Player identity:** `--player-01…12`, fixed L and C, hue-only variation, re-derived (not
reused) in dark at L 0.72. A player colour is **an index, never an identity**: the token
always carries the player's initial, because twelve pure hues do not survive colourblind
viewing alone. Assignment is front-loaded — the first six stay pairwise distinct under
protan/deutan/tritan — so colours are handed out **in palette order** as players are added.
Accent and alarm are excluded from the palette: a player must never read as a state.

**Settings are two header controls on Home, not a screen.** Locale (`EN`/`FR` chip) and
theme (moon toggle) are the only settings that exist. Both default to the OS
(`navigator.language`, `prefers-color-scheme`) and persist to `meta` only once touched.
Theme applies via `data-theme` on the document element.

**French is a layout constraint, not a translation pass.** Every string slot is sized for
the French string, which is the longer of the two. Banners and buttons carrying validation
copy are auto-height at 14px/1.45 — never fixed-height pills. Never tighten a container to
fit the English.

**Motion:** `--dur-value` 120ms for a total or rank label changing; `--dur-sheet` 200ms for
a bottom sheet in and out; `--ease` for both. Nothing else animates.

**Bottom sheets** (sheet-mode keypad, colour picker, tally entry sheet) are the app's only
overlay: `--radius-card` on the top corners only, `--shadow-sheet`, `--scrim` behind,
dismissed by swipe-down or backdrop tap. **There are no dialogs anywhere except destructive
confirmation** (delete a session).

**Icons:** `lucide-react` at `stroke-width: 2`, round caps — the artboards' inline SVGs are
placeholders for exactly this.

**Assets:** no raster or vector assets are required except game cover art for the shelf
(`1f`), which is a placeholder in the design — see Open Questions. The app icon (a tally of
five, diagonal in accent, `--radius-tile`) is described in `1p` and must be exported for
the manifest.

## Screens

Behaviour **and** design. Each section names the artboard it implements; band heights are
the contract, and where a platform can't hit the pixel, keep the minimum sizes and the
shed order rather than the exact number.

### 1. Home — `/` — `1d` (populated, one row swiped), `1e` (first run)

**Bands:** status 44 · header 52 (wordmark `Scorepad`, `EN`/`FR` chip, theme toggle) ·
scrolling list · pinned footer with the `New game` primary (52) + 20px bottom safe padding.

**Reads:** all sessions; `meta.lastExportedAt`; session count.

**Order:** `IN PROGRESS` eyebrow → active sessions, most recently touched first →
`FINISHED · N` eyebrow → finished sessions → the backup card. The list is never re-sorted
by game or name.

- **In-progress row:** game name + `SHEET`/`TALLY` badge; session name · `hand N` or
  `category N of M`; a standing line (`512 – 468` with `of 501` in ink-soft when the
  template has a `targetScore`); relative time (`20 MIN AGO`) and `Resume →`.
- **Finished row:** game name; `session · winner · score`; relative time; chevron.
- **Swipe a row left** to reveal `Delete` (alarm fill) and `Duplicate`. No per-row bin
  icon — a bin beside a resume target gets mis-tapped in bad light. Delete is the one
  action that confirms.
- **Duplicate** creates a new active session with the same template, players (names and
  colour indices) and an empty round set. *New action introduced by the design.*

**Backup card (in the list, not in settings — it is the only backup):** `BACKUP` eyebrow, a
relative stamp of `meta.lastExportedAt` (`4 DAYS AGO`; `NEVER` when unset), one line naming
how many games live on this phone only, then `Export` and `Import`. The stamp turns
`--color-advisory` past 14 days.

**First run (`1e`)** replaces the whole list with the tally-of-five mark at 72,
`Nothing scored yet`, one line of copy, and the eyebrow
`NO ACCOUNT · NO SERVER · WORKS OFFLINE`. Its footer carries `New game` **and**
`Import a backup` — a fresh device is exactly when someone needs their JSON back. No
onboarding carousel.

**Transitions:** → `/new`; → `/session/$id`; → `/session/$id/results` for a finished
session.

### 2. Game picker — `/new` — `1f` (the shelf), `1g` (no match)

**Bands:** status 44 · header 52 (back ←, `Choose a game`) · filter field 48
(`Filter ten games`) · two-up tile grid, 12px gaps, 16px gutters.

**Tile:** an art field, then title, a `SHEET`/`TALLY` badge, and a meta line derived from
the template — `{n} categories · {min}–{max}` for sheet, `to {targetScore} · {min}–{max}`
for tally, or `to {targetScore} · 2 teams` when `entry` is `"team"`. Ten titles, two-up:
small enough to recognise by box, too few to justify categories or a carousel.

**Art is generated, not bundled.** No image assets ship in v1. The art field is
`--color-paper-dim` with a hairline, carrying the game's name set like a box spine —
uppercase, `--text-screen`, `--tracking-wordmark`, `--color-ink-soft` — while the line
beneath keeps the proper-cased name, badge and meta. Two tiles a row, so the spine is the
thing you scan.

Deliberately **one treatment for all ten**, with no per-game hue: the twelve-colour palette
belongs to players and the app has exactly two signal colours, so a per-game colour would
be the first thing in the product that means nothing. Recognition comes from the name set
large. The field is a self-contained component — swapping in real box art later changes
what fills it and nothing about the layout.

**No match (`1g`):** the empty message and a `Clear filter` action. **`Add a custom game` is
cut from v1** — the authoring flow is explicitly undesigned, and a button that promises it
is worse than no button: people tap it. `Clear filter` returns you to ten games in one tap,
which is the actual way out of a no-match state on a shelf this small. The grammar already
exists, so authoring can land later without a rewrite; the entry point arrives with it.

**Counter mode ships as a template, not a branch.** The pre-design spec offered a "no
template" choice; the shelf has no such tile and shouldn't grow one. `counter.json` — a
`tally` template, one category, no `targetScore`, `players: [1, 12]` — gives the same
feature through the same code path, and the shelf stays one grid. *This resolves the
counter-mode open question.*

It also retires the in-memory undo stack `data-model.md` reserved for counter mode. A
counter tick is a hand, so `EDIT LAST` on the recap line and the cell grid in `2d` are the
undo — persisted, unlimited, and already built for every other tally game.

**Transitions:** → `/new/players`, carrying `templateId`.

### 3. Player setup — `/new/players` — `1h` (colour sheet open), `1i` (blocked, français)

**Bands:** status 44 · header 52 (←, title + `game · min to max` sub-line, right-aligned
`n / max` counter) · rows · `PLAYED RECENTLY` block · pinned primary 52.

The title reads `Players` when the template's `entry` is `"player"` (the default) and
`Teams` / `Équipes` when it is `"team"`; the counter beside it reads `n / max` teams. A
team template's `setupNote` also renders as an info banner above the rows
(`La belote se compte en équipes : chaque ligne est une équipe, pas une personne.`).

**Row (48px, `--h-cell`):** colour token · name input · grip handle for reorder · `×` to
remove. Reorder is a visible handle, not long-press-drag — the list is short and a
discoverable handle beats a hidden gesture on a phone somebody else is holding. Below the
rows, a dashed `Add a player` row.

**Recent names:** `PLAYED RECENTLY` eyebrow over 40px name pills from `meta.recentNames`.
Tap four pills and the second game night is set up in four taps.

**Colour sheet (bottom sheet):** header (the player's token, `Marie's colour`, `×`), a 4 × 3
grid of 56px swatches each carrying its **index number and letter**, then one line of copy
explaining that the initial stays on the token everywhere. Taken colours dim to 32% and are
non-selectable — they dim rather than disappear so the grid never reflows under a thumb.
The selected swatch takes a 2px ink ring. Never a dropdown: a dropdown hides exactly the
comparison you need.

**Validation is blocking and stated twice** — the primary dims **and** a plain line beneath
it says why, in `--color-alarm-ink` on `--color-alarm-bg`. Rules: player count within the
template's range; names non-empty and unique within the session (the drawn case is
`Deux équipes portent le même nom. Renommez-en une pour continuer.`). No toasts — a toast
is gone before it is read.

> **Handoff prose vs. artboard:** the README describes `1i` as blocking on an *uneven team
> split*. The artboard blocks on *duplicate team names*, and shows Belote as `2 / 2` rows
> with one row per team. The artboard is authoritative, and it agrees with the existing
> grammar: **there is no team model** — a team is a scoring entry whose name happens to
> contain two people. Nothing in `template-grammar.md` changes.

**On continue** (`Start scoring` / `Commencer la partie`): creates the `Session`
(snapshotting categories, `win`, `targetScore`, `tiebreakNote`), calls
`navigator.storage.persist()` if not yet granted, writes recent names.

**Transitions:** → `/session/$id`.

### 4. Scoresheet, `mode: "sheet"` — `/session/$id` — `1c`, `1j` (keypad up), `1k` (dark)

**One category at a time.** 7 categories × 7 players is 49 cells; on 390px that is either
horizontal scroll or 40px cells. One category per screen gives seven screens of seven
full-width rows, each 72px, with the category's rule readable in full — which matters
because the French rule text wraps to two lines. Rejected: a sideways-scrolling grid
(numbers leave the screen, headers detach) and one-player-at-a-time (you can't compare a
number against its peers, which is how typos are actually caught).

**Bands:** status 44 · header 52 (40×40 back, session title 18/600 + `game · N players` at
13 ink-soft, 40×40 ⋯) · category strip ~40 · category head ~72 · seven 72px player rows ·
footer ~76.

- **Category strip:** one mono 10 chip per category (+0.06em, `--radius-chip`). Done =
  `--color-paper-dim` + ✓; current = accent fill + `●`; future = card fill + hairline.
  Any category can be revisited by tapping its chip.
  **Chip text** = the first three letters of the *translated* `label`, uppercased; if two
  categories in a template collide (Ticket to Ride's `Completed tickets` /
  `Uncompleted tickets` do not, but French may), both fall back to their 1-based index.
  The artboard's chips (`MIL TRS WND CIV SCI COM GLD`) are hand-picked abbreviations;
  reproducing them exactly would cost a per-category `abbr` field in the grammar, and the
  full category name is directly beneath the strip at 28px. If the derived strip reads
  badly on a real template, that is the trigger to ask for the field.
- **Category head:** category `label` at 28/700 (`--text-category`), its `hint` at 13
  ink-soft beneath, and a mono `N OF M` marker.
- **Player row (72px, `--h-sheet-row`):** 28px colour token with initial · name at 17 · a
  mono 11 sub-line `<running total> SO FAR · <ordinal>` (a `=` suffix marks a tie) ·
  right-aligned 64×48 value cell, `--radius-ctrl`. Cell states: **empty** = paper fill,
  dashed `--color-line-dashed`, em-dash in `--color-ink-faint`; **filled** = card fill,
  hairline, value at 26; **focused** = card fill, 1px accent border **plus** `--focus-ring`.
- **Footer:** pager dots — one 28px disc per player, filled as that player's cell is
  entered — and the primary `Next category →`. On the last category the primary reads
  `See results →` and transitions to Results.

**Keypad (`1j`, bottom sheet):** header carrying the active player's token, name, a mono
status line (`SCIENCE · 45 SO FAR`), the live-typed value at 40 with a 2px accent caret;
a 3 × 4 grid of 60px keys (`1–9`, `±`, `0`, `⌫`) at 8px gaps, digits at 26 on card fill,
utilities on `--color-paper-dim` in ink-soft; a 52px action row of `Clear` (96px secondary)
and a primary **naming the next player** (`Next — Dan →`).

**Why a custom keypad, not the system one:** predictable height (the layout above never
jumps), a header that says *whose* number this is — essential when the phone is being
passed around — and room for `±` and a hand-over button. The system keyboard gives none of
that and hides half the rows.

**Behaviour:** every keystroke recomputes the value, the running total and the rank
*label* (`--dur-value`), and **rows never reorder** — the distraction problem is solved by
freezing position, not by hiding values. Entry is optional per cell; an unentered cell
scores 0 but renders as an em-dash, and Results warns if any cell is empty. Every cell
change persists immediately; there is no save action.

**Dark (`1k`)** is the same structure on the dark token set. The dark accent `#e0824f`
carries **ink** text, not paper — paper-white on it is 2.1:1 and fails. That is encoded as
`.btn-primary` in `tokens.css`; use the class rather than remembering the rule.

**⋯ menu:** rename session, add a late player, finish game.

### 5. Scoresheet, `mode: "tally"` — `/session/$id` — `2a` (6p), `2b` (10p), `2e` (2 teams), `2c` (entry sheet)

**Standings are the screen.** One row per player, stacked vertically — the only axis a
phone has spare. It scales 2 → 12 by getting **denser, never wider**; there is no
horizontal scroll on the surface the table watches all evening. The per-hand ledger lives
on its own screen (§6), because it is audit material opened to settle a dispute, not read
continuously. Rejected: a two-column standings grid at 5+ players (halves the name width,
kills the race bar, makes reading order ambiguous for a list that is fundamentally ranked).

**Three densities, one layout** — derived from player count, never stored:

| Players | Tier | Row height | Row carries | Recap |
|---|---|---|---|---|
| 2–3 | roomy | 132 | 40px token, name 19, total **52**, 4px race bar | inline ledger of the last 6 hands |
| 4–6 | comfortable | 102 | 36px token, name 18, total **38**, 3px race bar | one mono line |
| 7–12 | compact | 62 | 26px token, name 16, total **26**, 2px race bar, distance inline | one mono line |

Shed order as the table grows: the hands-won clause first, then the inline ledger, then the
row's second line. **The total never drops below 26.** At 10 players the bands total 844
exactly — nobody scrolls to see who is winning at any legal table size; 11–12 scrolls a row
or two, and 12 is past every game on the shelf.

**Row anatomy (comfortable, 102px):** grid `18px 36px 1fr auto`, 12px gaps, 16px gutters.
Rank in mono 13 `--color-ink-faint` — a number in the margin, because **rows never
re-sort**; colour token with initial; name at 18/600 with a `LEADS` pill in accent for rank
1, hidden via `opacity: 0` for everyone else so the name baseline never shifts; a mono 11
sub-line (`3 WON · +60 LAST` / `3 WON · NO SCORE`); right column = total at 38/700 tabular
(accent for the leader, ink otherwise) over mono 11 `155 to go`; then a full-width 3px race
bar on `--color-paper-dim` filled to `total / targetScore` (accent for the leader,
`--color-ink-faint` otherwise). Rows are in **seat order** — the order players were added.
Rank is displayed, never used to sort; the person you are looking for is where they were
last hand. Sorting happens exactly once, on Results.

**Recap line (~30):** mono 10, `HAND 14 · CHLOÉ TOOK 60`, with `EDIT LAST` in accent at the
right, which reopens the entry sheet for that hand. One line of text, not per-player chips
— six players with three-digit scores overflow 390px, and the chips duplicated what every
row already says.

**Entry bar (~106, pinned):** card fill, 2px top rule, a 60px accent button
`Enter hand N →`, 20px bottom safe padding. At hand 1 and hand 40 it is in the same place.

**Inline ledger at ≤3 players (`2e`):** the leftover height is worth something at two or
three entries, so the last six hands return under the standings — a mono column head
(`HAND | MARIE & LUC | SOFIA & TOM`) and 46px rows (`--h-tally-row`) carrying the hand score
at 19 and the running total in mono 12 beside it, **oldest above newest and anchored to the
foot** so the newest hand sits against the entry bar. At four players the block would show
two hands and stop being useful, so it disappears and §6 takes over. One conditional block,
same screen, same entry sheet. **Confirmed in scope** — Belote to 501 is the case the tally
rework had to not regress, and at two teams this block is the difference between seeing the
evening and tapping ⋯ for it.

**Target passed:** a mono line above the entry button
(`MARIE & LUC PASSED 501 · FINISH FROM ⋯ WHEN THE TABLE IS DONE`) in
`--color-advisory-ink`. Not a dialog, not a dismissible banner, and **never an automatic
end** — passing the target is a fact about the game; the table decides when it is over, and
the session status does not change.

**Low-wins templates** (`win: "lowest"`, e.g. Black Lady): rank 1 is the *lowest* total, its
pill reads `SAFEST` not `LEADS`, and the race bar means danger — distance to bust, not
progress.

**Entry sheet (`2c`) — one sheet walks the table.** The standings behind dim under
`--scrim`. Contents, top to bottom:

1. A 36 × 4 grab handle.
2. **Active player header:** 30px token, name 17/600, a mono 11 status line, the live value
   at 38 with a 2px accent caret.
3. **Player strip:** one equal-width tile per player (18px token + value at 19), 6px gaps.
   Active = accent border on a lifted fill; entered = card fill, ink value; untouched = dim
   fill, ink-faint em-dash. The strip is **both the progress indicator and random access** —
   tap any tile to jump back when someone corrects themselves two players later, which is
   the failure a strictly sequential flow could not survive at this table size. At 10+
   players the tiles drop the token and keep the number.
4. **Keypad:** the same 3 × 4 key set as sheet mode at 52px keys, 7px gaps.
5. **Actions:** `Clear` / `Effacer` (88px secondary) and a primary **naming the next
   player** (`Tom →`). The last hand-over saves the hand and dismisses the sheet.

Rejected: a modal per player (five dialogs a hand); a spreadsheet row of N inputs with the
system keyboard (each field ~62px wide, numbers unreadable, keyboard covers half the screen).

**Fixed-total hands.** A template with `handTotal` (Black Lady: 26) renders a live check in
the entry-sheet header — `MANCHE 9 · 26 À RÉPARTIR · 7 PLACÉS` — in `--color-advisory-ink`
while the hand is out of balance. Templates without one don't render the clause.

> **Deliberate departure from the handoff**, which refuses to save until the hand balances.
> **The hand saves regardless.** Shooting the moon scores 26 to *each* opponent or −26 to
> the shooter — both legal, both unbalanced. The counter does the arithmetic; it does not
> veto the table. Rationale in `template-grammar.md`.

**⋯ menu:** hand history, rename session, add a late player, finish game.

### 6. Hand history — `/session/$id/history` — `2d`

Reached from ⋯ on a tally session. **Bands:** status 44 · header 52 (title 20/700 + `×`) ·
segmented control `Per hand | Running` (42px, ink fill on the active half) · column head
(24px player tokens on `--color-paper-dim`, 2px bottom rule) · 56px hand rows · a pinned
`TOTAL` row (62) on card fill · a footer strip
(`HANDS 7–14 · SCROLL UP FOR EARLIER` / `TAP A CELL TO FIX`).

**Grid columns:** 44px for the hand number + 60px per player = 416px inside 390 — so at six
players the sixth column **deliberately bleeds past the right edge**, which is the scroll
affordance. Horizontal scroll is acceptable *here and nowhere else*, because nobody lives on
this screen.

Zeros render as a faint interpunct `·` so the one scoring hand in an Uno row is legible at
a glance. Cells are tappable for correction and totals recompute live.

### 7. Results — `/session/$id/results` — `1n` (light), `1o` (dark)

**The one moment sorting is allowed.**

**Bands:** status 44 · header 52 (`×`, session name + `game · finished HH:MM`) · winner
card · tiebreak card (conditional) · `FINAL · N PLAYERS` ranked list at 46px rows · footer.

- **Winner card:** card fill, 1px accent border, `--radius-card`. One winner block however
  many winners there are — tied players share the block (`JOINT WINNERS`, overlapping
  tokens, `Chloé and Émile`), share the rank number, and carry `=` down the list.
- **Tiebreak card** (only when ranks tie and the session snapshot has a `tiebreakNote`):
  the eyebrow `TIEBREAK · {game}`, the note itself, and a line saying out loud that the app
  won't apply it. **A tie stays a tie.** Rejected: a "resolve tie" button (invents a
  result), a coin-count prompt (a new data model for one edge case), and confetti.
- **Ranked rows (46px):** rank number (+ `=` on a tie) · token · name · total.
- Below the ranking, per-category or per-hand takeaways in mono 11.
- **Footer:** a three-up row of `Play again` · `Reopen` · `Export` at `--h-tap`, then
  `Back to games` full width. Export is here because finishing a game is the moment somebody
  wants to keep it; Reopen is deliberately as prominent — "finished" is a state, not a lock,
  and a mis-tap must be one tap to undo. **`Play again` duplicates the session and opens the
  new one** — same template, same players, same colour indices, empty rounds — which is the
  same operation Home's swipe-`Duplicate` performs, offered at the moment the table actually
  asks for it.

**Writes:** sets `status: "finished"` and `finishedAt`. `Reopen` returns the session to
`active` and clears `finishedAt`. `Play again` writes a new session and leaves the finished
one untouched.

> **Approved departure from `1n` / `1o`.** The artboards draw three actions; the handoff
> prose lists `Play again`, and it is reinstated as a fourth — decided 2026-08-19. The
> paired row becomes three-up rather than gaining a band, so the screen's height budget is
> unchanged; at 390px that is three ~111px buttons inside the 16px gutters at 12px gaps,
> which holds `Rejouer` / `Rouvrir` / `Exporter` in French. Verify the fit against the
> artboard before building — if French forces a fourth band, the band heights above are what
> gives, not the button. `Done` from the prose stays cut; `Back to games` is that action.

### Cross-screen rules

- **Pass-around:** the entry surface always names *whose* number is being typed, and the
  primary button always names *who is next*. That is the whole affordance for handing the
  phone over — it needs no explanation and no other UI.
- **Rows never reorder while scoring.** Sheet mode and tally mode both hold seat order;
  sorting happens exactly once, on Results.
- **Validation tiers:** blocking (dimmed primary + inline reason in `--color-alarm-*`) only
  where the game cannot proceed — which after the `handTotal` decision means exactly one
  place: invalid player setup (`1i`). Everything else is advisory in `--color-advisory-*`
  and never blocks: an unbalanced fixed-total hand, target passed, an empty cell at
  Results, a stale backup.
- **Confirmation dialogs exist for exactly one action:** deleting a session.
- **Scrolling:** only Home's list and Hand history scroll. If a screen you are building
  scrolls at a legal player count, the density tier is wrong.

## Testing Strategy

Vitest. A `test` block must be added to `vite.config.ts` — none exists today.

| Level | Target | Requirement |
|---|---|---|
| Unit | `src/lib/scoring.ts` | Exhaustive. Including: integer/negative multipliers, `divideBy` exactness against `Math.floor(n/3)` across 0–10000, empty entries, all-zero ties, `win: "lowest"` ordering, multi-round accumulation, an empty appended round contributing 0 |
| Unit | `src/lib/templates/validate.ts` | Every rule in `template-grammar.md` has a failing-case test, `handTotal` and `entry` included |
| Data | `src/lib/templates/*.json` | A test iterates **every** bundled template, asserts it validates, and asserts a known fixture scores to a hand-checked total. Adding a template without a fixture fails CI |
| Integration | `src/lib/db.ts` | Session write → reload → identical read; schema-version migration runs; a 15-round tally session round-trips |
| Unit | `features/scoresheet/utils` density tier, rank + tie labelling, race-bar fraction, fixed-total balance check | Pure functions over plain data. Boundaries: 3→4 and 6→7 players flip the tier; a tie yields the same rank and a `=` on both |
| Component | `Keypad`, `EntrySheet`, `ColourSheet` | The three surfaces where a mis-tap costs data: `±` and `⌫` on every value shape, jumping back via the player strip mid-hand, taken colours refusing selection |
| Behaviour | fixed-total hands | A Black Lady hand summing to 26 × (n−1) or −26 **saves**. The advisory counter is asserted separately from the save path, so nobody re-couples them |
| Design contract | any screen component | One assertion per contract that a refactor can silently break: no interactive box below 44px, no type below 16px in a body slot, `.num` on every recomputing figure |
| Visual | — | No screenshot/pixel diffing in v1. The artboards are the reference; a human compares |

Non-negotiable: **the 7 Wonders coin case (`divideBy: 3`) has a dedicated regression
test.** The first draft of this spec got it wrong; a test is cheaper than getting it wrong
again in code.

**Every screen is rendered at 390 × 844 in French at its worst-case player count** — 7
players on the sheet, 12 in tally standings, 12 in the entry-sheet player strip — and must
fit without the frame scrolling. This is the one UI assertion worth automating: it is the
constraint the whole design was built against, and the one a well-meaning copy change
breaks silently.

No coverage percentage target. `src/lib/scoring.ts` and `src/lib/templates/` are the code
that can be silently wrong, and they are fully covered; a percentage across the whole tree
would just reward testing getters.

## Boundaries

**Always:**
- Keep `src/lib/scoring.ts` and `src/lib/templates/validate.ts` pure — no React, no DB,
  no I/O.
- Respect unidirectional flow; never import one feature from another.
- Persist every cell edit immediately; never rely on an explicit save.
- Add a scoring fixture test alongside any new template.
- Take colours, sizes, radii, durations and heights from `tokens.css`. A literal hex,
  px height or ms duration in a component is a bug.
- Pair every player colour with the player's initial. Colour alone never identifies anyone.
- Name the active player on any entry surface, and the next player on its primary button.
- Size containers for the French string.
- Run `bun run lint` and `bun test` before committing.
- Treat integers as integers: no floating-point multipliers in templates, ever.

**Ask first:**
- Adding any dependency.
- Adding a field to the template grammar (each one is a permanent compatibility surface).
- Introducing a network call — v1's whole architecture rests on there being none.
- Changing the IndexedDB schema shape.
- Adding a token to `tokens.css`, or a third signal colour.
- Departing from an artboard. The artboards are the spec; a deviation is a design change,
  not an implementation detail.

**Never:**
- Reintroduce sync, rooms, participants, or server-authoritative state in v1.
- Let a template edit retroactively change a finished session's score.
- Silently drop a category a session was created with.
- Auto-resolve a tie.
- Re-sort rows while scoring. Sorting happens once, on Results.
- End a game automatically when `targetScore` is passed.
- Use the system keyboard for score entry, or a dialog for anything but deleting a session.
- Use a player colour as a status, or accent/alarm as a player colour.

## Success Criteria

Specific and testable:

1. `bun run build` emits a static bundle with **no server entry point**.
2. All ten seed templates (6 board, 4 card) validate, and each scores a hand-checked
   fixture correctly — including a multi-round Belote fixture and a `win: "lowest"`
   Black Lady fixture.
3. `divideBy: 3` matches `Math.floor(n/3)` for every `n` in 0–10000.
4. With devtools offline from first paint after install: create a session, score it,
   finish it, reload — the session is present and correct. **Zero network requests**
   recorded after the initial load.
5. JSON export → wipe IndexedDB → import → all sessions restored byte-identical.
6. A full 4-player Wingspan sheet (6 categories, 24 cells) can be completed without the
   app losing focus, reordering entry fields, or requiring a save action.
7. A 15-hand Belote session (2 team entries) accumulates correctly and persists every
   hand; force-quitting after hand 12 loses nothing at all — with counter mode's undo stack
   retired, no in-memory state outlives a hand.
8. `navigator.storage.persist()` is called and its result observable.
9. The app is installable: valid manifest, service worker, offline cold start.
10. Every screen renders in French at its worst-case player count within 390 × 844 with no
    frame scrolling — 7-player 7 Wonders sheet, 10- and 12-player tally standings, the
    12-tile entry-sheet strip. Only Home and Hand history scroll, by design.
11. Light and dark both pass 4.5:1 for body text and for every player token with its
    initial, and the accent primary carries ink in dark (`.btn-primary`).
12. A 10-player Uno hand is entered end to end from one sheet without dismissing it, and
    jumping back to player 3 mid-hand preserves what players 4–9 already entered.
13. Nothing interactive is under 44px and no body type is under 16px, asserted in test.
14. Toggling theme and locale from the Home header persists across a reload, and an
    untouched install follows the OS for both.

## Open Questions

- ~~Does TanStack Start build cleanly with no server?~~ **Yes — SPA mode or static
  prerendering.** Task 0 is now "pick one and pin it", not "find out if this is possible".
- ~~How is the unidirectional import rule enforced?~~ **Convention and review, documented in
  `CLAUDE.md` and `README.md`.** No second linter.
- Does the installed `@tanstack/react-db` ship a local/IndexedDB collection adapter, or is
  a thin hand-written store simpler than adapting a query-oriented one? The last stack
  question standing.
- ~~`handTotal` and `entry: "player" | "team"`~~ — **both approved.** `handTotal` is
  advisory, not blocking; `entry` labels the setup screen and nothing else. Specified in
  `template-grammar.md`; no open decision remains.
- ~~Cover art~~ — **decided: generated, one treatment, no assets.** See §2. Real art is a
  later swap inside one component, not a layout change.
- ~~`Add a custom game`~~ — **decided: cut from v1.** `1g` shows `Clear filter` instead. Tell
  the designer, so the button comes out of `1g`.
- ~~The inline ledger at ≤3 players~~ — **decided: keep it.** `2e` ships as drawn.
- ~~`Play again` on Results~~ — **decided: reinstated as a fourth footer action**, a
  deliberate departure from `1n` / `1o` approved 2026-08-19. It duplicates the session and
  opens it. Home's swipe-`Duplicate` stays; the two share one function. Tell the designer,
  so the footer row comes back as three-up.
- Do finished sessions become immutable, with "reopen" as an explicit action? `1n` draws
  `Reopen` as a peer of `Export`, so: no, and reopening is one tap.
- Is a service worker needed in v1 for offline, given the bundle is static and cacheable
  by the browser anyway? Needed for installability regardless.
