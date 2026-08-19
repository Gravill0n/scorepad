# Handoff: Scorepad — mobile scorekeeping PWA

## Overview

Scorepad is a phone-first PWA for keeping score at a table: you open it, pick a game
off a ten-title shelf, name the players, and pass the phone around. It has to beat
paper — legible at arm's length, no chrome to learn, offline, and fast enough that
nobody reaches for a pencil instead.

Two scoring modes cover the whole shelf:

- **Sheet mode** — a fixed set of categories scored once each (7 Wonders, Catan,
  Wingspan, Azul, Ticket to Ride, Splendor). Worst case is 7 categories × 7 players.
- **Tally mode** — an open-ended run of hands, first to a target (Uno to 500 with up
  to 10 players, Belote to 501 in 2 teams, Whist, Black Lady to 100 where **low
  wins**). Player count is 2–12.

Language (English / French) and theme (light / dark) are the only two settings, both
defaulting to the OS preference. **French is a first-class layout constraint**, not a
translation pass — the tightest screens in this bundle are drawn in French on purpose.

## About the design files

The files in this bundle are **design references authored in HTML** — prototypes that
show intended look and behaviour. They are **not production code to lift**. The
`.dc.html` file is a single-file design canvas with all sixteen artboards laid out
side by side; it is not an app shell.

Your task is to **recreate these designs in the target codebase's existing
environment** (React, Vue, SwiftUI, native, whatever is already there) using its
established patterns, component library, routing and state conventions. If no
environment exists yet, pick the appropriate stack for an offline-first installable
phone app and build it there.

`tokens.css` is the exception: it is intended to be used directly. It is a Tailwind 4
`@theme` block plus a plain-CSS `[data-theme="dark"]` counterpart, and every value in
the artboards comes from it.

## Fidelity

**High-fidelity.** Final colours, type scale, spacing, row heights and copy. Every
artboard is drawn at **390 × 844 CSS px** (iPhone 12/13/14 logical viewport) and every
one **fits its content within 844px with no vertical scrolling of the frame itself** —
that constraint is load-bearing and was verified per artboard. Recreate pixel-for-pixel
where the target platform allows; where it doesn't, keep the *contract* below (minimum
sizes, what may be dropped at which density) rather than the exact pixel.

Non-negotiable contracts:

- Body type is **16px**, never 14 — this is read across a table, not at a desk.
- Anything interactive is **≥ 44px** tall.
- Any figure that recomputes uses **tabular numerals** so digits don't jitter.
- Hairlines (1px `--color-line`) are the only elevation. Shadows exist for bottom
  sheets and nothing else.
- Two signal colours only: accent `#a8431d` and alarm `#b3261e`. A player colour is
  neither — it's an index (see Player identity).

---

## Screens / views

Artboard ids below (`1c`, `2a`, …) are the visible badges in the canvas; they are
stable references you can use in commit messages and questions.

### 1c — Scoresheet, one category at a time  *(the chosen sheet layout)*

**Purpose:** enter every player's score for one category, then advance to the next.

**Why this and not a grid:** 7 × 7 = 49 cells cannot be shown at once on 390px without
either horizontal scroll or ~40px cells. Two alternates were built and rejected: a
sideways-scrolling grid (numbers leave the screen, headers detach) and one-player-at-a-time
(you can't compare a number against its peers, which is how typos are actually caught).
One category at a time gives **seven screens of seven rows**, each row full-width and
48px+ tall, with the category's scoring rule readable in full — which matters because
the French rule text wraps to two lines.

**Layout, top to bottom:**

| Band | Height | Contents |
|---|---|---|
| Status bar | 44 | time / battery, mono 12, `--color-ink-soft` |
| Header | 52 | 40×40 back button, session title (18/600) + `game · N players` (13, ink-soft), 40×40 ⋯ |
| Category strip | ~40 | 7 chips (`MIL TRS WND CIV SCI COM GLD`), mono 10 +0.06em; done = `--color-paper-dim` + ✓, current = accent fill + `●`, future = card + hairline; radius 4 |
| Category head | ~72 | Category name at 28/700, its rule at 13 ink-soft below |
| Player rows | 72 each × 7 | see below |
| Footer | ~76 | pager dots (one 28px disc per player), primary "Next category →" |

**Player row (72px, `--h-sheet-row`):** 28px colour token with the player's initial ·
name at 17 · a mono 11 sub-line reading `<running total> SO FAR · <ordinal> ` (a `=`
suffix marks a tie) · right-aligned value cell 64×48, radius 6. Cell states: empty =
paper fill, dashed `--color-line-dashed`, em-dash in `--color-ink-faint`; filled = card
fill, hairline, value at 26; focused = card fill, 1px accent border **plus**
`--focus-ring` (`0 0 0 3px` accent at 50%).

### 1j — Scoresheet with the keypad up (mid-entry)

Same screen with a **custom numeric keypad** as a bottom sheet (`--radius-card` on the
top corners only, `--shadow-sheet`). Sheet contents: a header carrying the active
player's token, name, and current running total, with the live-typed value at 40 and a
2px accent caret; a 3 × 4 grid of 60px keys (`1–9`, `±`, `0`, `⌫`) at 8px gaps, digits
at 26 on card fill, utilities on `--color-paper-dim` in ink-soft; then a 52px action row —
"Clear" (96px, secondary) and a primary button naming **the next player** (`Ben →`).

**Why a custom keypad, not the system one:** predictable height (the layout above it
never jumps), a header that says *whose* number this is — essential when the phone is
being passed around — and room for `±` and a hand-over button. The system keyboard
gives none of that and hides half the rows.

### 1k — Scoresheet, dark

Identical structure with the dark token set. Note the dark accent (`#e0824f`) carries
**ink** text, not paper (paper-white on it is 2.1:1 and fails) — encoded as
`.btn-primary` in `tokens.css`.

### 1d / 1e — Home (populated, one row swiped open) and Home (first run)

**Purpose:** resume a game in one tap; start a new one in two.

Order: in-progress sessions first (each row: game name, session name, `hand N` or
`category N of M`, player tokens), then finished games, then a **backup card**.
Swiping a row left reveals Delete (`--color-alarm`) and Duplicate.

**Backup is a card in the list, not a settings row** — it's the only destructive-risk
surface in an app with no account, so it sits where it will actually be seen.

First run replaces the list with a single empty state: the wordmark, one line of copy,
and one primary action. No onboarding carousel.

### 1f / 1g — Game picker (the shelf) and filter with no match

Ten titles, **two-up with cover art** — small enough to recognise by box, too small to
justify categories or a carousel. Each tile shows a `SHEET`/`TALLY` badge and a meta
line (`7 categories · 3–7`, `to 501 · 2 teams`). No-match state offers "Add a custom
game" rather than a dead end.

### 1h — Player setup, colour sheet open

Rows of name inputs (48px, `--h-cell`) each with its colour token; the token opens a
**bottom sheet of the twelve colours**, never a dropdown — a 4 × 3 grid of 56px
swatches, each carrying its index number and letter, with the four already-taken hues
dimmed to 32% and non-selectable. Selected swatch takes a 2px ink ring.

### 1i — Teams, blocked, français

The team games (Belote, Whist) need an even split. When it isn't satisfied the primary
button is disabled and the reason is stated inline in `--color-alarm-ink` on
`--color-alarm-bg` — blocking validation is the *only* use of alarm colour besides
destructive actions. Drawn in French because "Il faut deux équipes de deux joueurs" is
the longest string in the app.

---

## Tally mode  *(reworked — this is the current proposition)*

The first tally design put a per-hand ledger (one column per player, one row per hand)
on the main screen. That only works while every player fits inside 390px: two teams,
three at a squeeze. Uno seats ten. **The primacy therefore flips.**

- **Standings are the screen.** One row per player, stacked vertically — the only axis
  a phone has spare. Scales 2 → 12 by getting **denser, never wider**. No horizontal
  scroll on the surface the table watches all evening.
- **The ledger moves to its own screen** (`2d`). It is audit material, opened to settle
  a dispute, not read continuously.
- **A hand is entered by one sheet that walks the table** (`2c`) — the same gesture at
  two players or ten.

**Three densities, one layout:**

| Players | Row height | Row carries | Recap |
|---|---|---|---|
| 2–3 (roomy) | 132 | 40px token, name 19, total **52**, 4px race bar | inline ledger of the last 6 hands |
| 4–6 (comfortable) | 102 | 36px token, name 18, total **38**, 3px race bar | one mono line |
| 7–12 (compact) | 62 | 26px token, name 16, total **26**, 2px race bar, `gap` inline | one mono line |

Shed order as the table grows: the hands-won clause first, then the inline ledger, then
the row's second line. The total never drops below 26.

### 2a — Uno, 6 players, comfortable

Bands: status 44 · header 52 · recap line ~30 · six 102px rows · entry bar 106.

**Row anatomy (102px):** grid `18px 36px 1fr auto`, 12px gaps, 16px gutters.
Rank in mono 13 `--color-ink-faint` (a number in the margin — **rows never re-sort**);
36px colour token with initial; name at 18/600 with a `LEADS` pill in accent for rank 1
(hidden via `opacity:0` for everyone else so the name baseline never shifts); mono 11
sub-line `3 WON · +60 LAST` / `3 WON · NO SCORE`; right column = total at 38/700
tabular (accent for the leader, ink otherwise) over mono 11 `155 to go`; then a
full-width 3px race bar on `--color-paper-dim`, filled to `total / target` (accent for
the leader, `--color-ink-faint` otherwise).

**Recap line:** mono 10, `HAND 14 · CHLOÉ TOOK 60` with `EDIT LAST` in accent at the
right. It is one line of text, not per-player chips: chips of 6 players with 3-digit
scores overflow 390px, and they duplicated what every row already says. The per-player
delta lives in the row.

**Entry bar:** card fill, 2px top rule, 60px accent button `Enter hand 15 →`, 20px
bottom safe padding. Pinned — at hand 1 and hand 40 it is in the same place.

Copy note: rows read "seat order", i.e. the order players were added. Rank is displayed,
never used to sort — the person you're looking for is where they were last hand. (Sheet
mode follows the same rule; sorting happens exactly once, on Results.)

### 2b — Uno, 10 players, compact

Bands: status 44 · header 52 · meta line 30 · ten 62px rows · entry bar 88 = 844
exactly. **No scrolling to see who is winning, at any legal table size.** 11–12 players
scrolls one or two rows; 12 is past every game on the shelf.

Compact row: grid `20px 26px 1fr auto`, name 16 with the distance-to-target inline in
mono 10, total 26/700, 2px race bar.

Rejected: a two-column standings grid at 5+ players — halves the name width, kills the
race bar, and makes reading order ambiguous for a list that is fundamentally ranked.

### 2c — Entry sheet, 5 players, dark, français  *(Black Lady)*

The standings behind are dimmed by `--scrim`; the sheet holds:

1. 36 × 4 grab handle.
2. **Active player header:** 30px token, name 17/600, mono 11 status line, live value
   at 38 with a 2px accent caret.
3. **Player strip:** one small tile per player (18px token + value at 19), equal-width,
   6px gaps. Tile states: active = accent border on a lifted fill; entered = card fill,
   ink value; untouched = dim fill, ink-faint em-dash. This strip is **both the progress
   indicator and random access** — tap any tile to jump back when someone corrects
   themselves two players later. At 10+ players the tiles drop the token and keep the
   number.
4. **Keypad:** 3 × 4, 52px keys, 7px gaps (same key set as sheet mode).
5. **Actions:** `Effacer` (88px secondary) + primary naming the next player (`Tom →`).
   The last hand-over saves the hand and dismisses the sheet.

**Fixed-total games:** Black Lady distributes exactly 26 points per hand, so the header
carries a live check — `MANCHE 9 · 26 À RÉPARTIR · 7 PLACÉS` — and **save is refused
until the hand balances**. Games without a fixed hand total simply don't render that
clause.

**Low-wins games:** Black Lady is scored to 100 where lowest wins. Rank 1 = lowest
total, its pill reads `SAFEST` not `LEADS`, and the race bar means danger (distance to
bust), not progress.

Rejected: a modal per player (five dialogs a hand); a spreadsheet row of N inputs with
the system keyboard (each field ~62px wide, numbers unreadable, keyboard covers half).

### 2d — Hand history

Reached from ⋯. Bands: status 44 · header 52 (title 20/700 + `×`) · segmented
`Per hand | Running` (42px, ink fill on the active half) · column head (24px player
tokens on `--color-paper-dim`, 2px bottom rule) · hand rows 56px · pinned `TOTAL` row 62
on card fill · footer strip `HANDS 7–14 · SCROLL UP FOR EARLIER` / `TAP A CELL TO FIX`.

Grid columns: `44px` for the hand number + `60px` per player = 416px inside 390 —
so at six players the sixth column **deliberately bleeds past the right edge**, which
is the scroll affordance. Horizontal scroll is acceptable *here* and nowhere else,
because nobody lives on this screen. Zeros render as a faint interpunct `·` so the one
scoring hand in an Uno row is legible at a glance.

Cells are tappable for correction; totals recompute live.

### 2e — Belote, 2 teams, roomy

Proves the rework doesn't regress the case the old design served. Two 132px standings
rows (52px numerals, 40px tokens), then — because the leftover height is worth
something at ≤3 players — the **inline ledger** returns: a mono column head
(`HAND | MARIE & LUC | SOFIA & TOM`) and the last six hands at 46px, each row carrying
the hand score at 19 and the running total in mono 12 beside it, **oldest above newest
and anchored to the foot** so the newest hand sits against the entry bar. At four
players the block would show two hands and stop being useful, so it disappears and the
⋯ history takes over — same screen, same entry sheet, one conditional block.

**Target passed:** a mono line above the entry button
(`MARIE & LUC PASSED 501 · FINISH FROM ⋯ WHEN THE TABLE IS DONE`) — not a dialog, not a
dismissible banner, and never an automatic end. Passing the target is a fact about the
game; the table decides when it's over.

---

### 1n / 1o — Results, light and dark

**Purpose:** the one moment sorting is allowed.

Winner card (card fill, 1px accent border, radius 12) with the winning name and score;
then ranked rows at 46px — rank number, token, name, total. **A tie stays a tie:** tied
players share a rank number and both get a `=` suffix; nothing invents a tiebreak. Below
the ranking, per-category or per-hand takeaways in mono 11. Footer: `Play again` (same
players, same game) and `Done`.

### 1p — Foundations

Reference artboard: the twelve player colours in both themes with their dichromatic
behaviour, the height scale (40 / 44 / 46 / 48 / 52 / 60 / 72), the type scale, and the
app icon (a tally of five — the one mark that reads as "keeping score" in every language
on the box) at 128px with `--radius-tile` 28.

---

## Interactions & behaviour

**Totals update live as you type; rows never reorder.** The value, the running total,
and the rank *label* recompute on every keystroke (`--dur-value` 120ms) but positions
are frozen. The distraction problem is solved by freezing position, not by hiding values.

**Sheet mode flow:** category strip → 7 rows → "Next category" → repeat → Results.
Any category can be revisited from the strip. Entry is optional per cell; an unentered
cell counts as 0 but renders as an em-dash, and Results warns if any cell is empty.

**Tally flow:** standings → "Enter hand N" → entry sheet walks every player →
save → back to standings with the recap line updated. Corrections: `EDIT LAST` on the
recap line reopens the sheet for that hand; older hands are fixed cell-by-cell in `2d`.

**Bottom sheets** (keypad, colour picker, entry sheet): 200ms `cubic-bezier(0.2,0,0.2,1)`
in and out, scrim behind, dismiss by swipe-down or backdrop tap. No dialogs anywhere in
the app except destructive confirmation.

**Validation:** blocking only where the game can't proceed — uneven teams (`1i`), an
unbalanced fixed-total hand (`2c`). Everything else is advisory in `--color-advisory-*`.

**Pass-around:** the entry sheet always names *whose* number is being typed, and the
primary button always names *who is next*. That is the whole affordance for handing the
phone over.

**Offline / PWA:** all state is local; no account, no network path in these designs.
Splash screen and install prompt are explicitly **out of scope** and not drawn.

**Localisation:** every string slot in these artboards is sized for the **French**
string, which is the longer of the two. Don't tighten a container to fit the English.

## State

Per session: `game` (id, mode, categories or target, low-wins flag, fixed hand total,
player min/max, team requirement), `players[]` (name, colour index 1–12, team), and
either `cells[player][category]` (sheet) or `hands[][player]` (tally). Derived, never
stored: totals, ranks, ties, distance to target, race-bar percentage, density tier
(from player count), leader.

Transient UI state: active cell / active player, live keystroke buffer, which sheet is
open, category page index, history view mode (`per hand` | `running`).

Session lifecycle: `in progress` → `finished` (explicit, from ⋯) → archived on Home.
Passing the target does **not** transition the state.

## Design tokens

All of them are in **`tokens.css`** in this bundle — paste the `@theme` block into a
Tailwind 4 entry stylesheet, or read the `:root` / `[data-theme="dark"]` values
directly. Summary of the ones you'll reach for constantly:

- Surfaces (light): paper `#f6f1e7`, paper-dim `#ece4d4`, card `#fffdf7`,
  line `#d8cdb8`, line-strong `#cfc5b0`
- Ink: `#2b2620` / soft `#6b6354` / faint `#a39882`
- Signals: accent `#a8431d`, alarm `#b3261e`, advisory `#c88a2e` (+ bg/ink pairs)
- Dark: paper `#201c16`, card `#2a241c`, ink `#e6ddcc`, line `#443c2f`,
  accent `#e0824f` (ink text on it, not paper)
- Type: system sans + `ui-monospace` for every label, eyebrow and running total.
  Scale 11 / 13 / 16 / 17 / 18 / 22 / 26 / 28 / 44
- Space: 4px grid — 4 / 8 / 12 / 16 / 20 / 32; 16px screen gutter
- Radius: 4 chip · 6 control · 12 card & sheet · 999 token · 28 app tile
- Heights: 40 icon button · 44 tap floor · 46 ledger row · 48 cell · 52 primary ·
  60 key · 72 sheet row
- Motion: 120ms value, 200ms sheet, `cubic-bezier(0.2, 0, 0.2, 1)`

**Player identity:** twelve fixed-L, fixed-C oklch hues (`--player-01…12`), re-derived
rather than reused in dark (L 0.72 so each clears 4.5:1 on dimmed paper). Assignment
order is front-loaded for dichromatic separability — the first six stay pairwise
distinct under protan/deutan/tritan. **Colour is always accompanied by the player's
initial on the token.** Twelve pure hues cannot survive colourblind viewing on their
own, so the colour is an index, never the identity.

## Assets

No raster or vector assets are required. Icons in the artboards are inline stroke SVGs
(arrow, check, info, chevron) at `stroke-width: 2`–`2.5`, `stroke-linecap: round` —
substitute the codebase's existing icon set. Game cover art in the shelf (`1f`) is a
**placeholder** and needs real art or a generated fallback. The app icon is described in
`1p` but not exported.

## Files

- `Scorepad.dc.html` — the design canvas: all sixteen artboards plus the written
  decision and rejection notes under each one. Open it in a browser (it needs
  `support.js` beside it). Artboard ids are visible badges: `1c`–`1k`, `1n`–`1p`,
  `2a`–`2e`.
- `tokens.css` — the design tokens, meant to be used as-is.
- `support.js` — runtime needed only to open `Scorepad.dc.html` locally. Not part of the
  design and not for the app.

## Open questions for the developer / designer

1. **Inline ledger at ≤3 players** (`2e`) is a conditional block. If it complicates the
   implementation more than it's worth, dropping it and always using `2d` is an
   acceptable simplification — say so and it comes out of the design too.
2. **Custom games** (`1g` offers "Add a custom game") are not designed — the flow needs
   a spec if it ships in v1.
3. **Splash screen and install prompt** are deliberately undesigned.
