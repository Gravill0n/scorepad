# Spec: Data Model & Storage

## Storage architecture

IndexedDB is the only store. There is no server, no network request after initial page
load, and no second writer for any record. This removes, by construction: sync queues,
conflict resolution, merge logic, idempotency keys, room codes, participants, and
server-assigned timestamps.

```
IndexedDB "bgc"
  ├── sessions   (keyPath: "id")   → all past and current games
  └── meta       (keyPath: "key")  → recent names, settings, backup stamp, schema version
```

`meta` keys: `schemaVersion` (int) · `recentNames` (string[], capped at 20) ·
`lastExportedAt` (ISO 8601 | null — the Home backup card's stamp, amber past 14 days) ·
`locale` (`"en" | "fr"` | absent = follow the OS) · `theme`
(`"light" | "dark"` | absent = follow the OS). The last two are the only settings the app
has; absent means *untouched*, which is not the same as a stored default.

Templates are **not** stored — they are statically bundled from `src/lib/templates/*.json`
(see `template-grammar.md`). A session snapshots the parts of the template that affect
scoring, so a template edit never retroactively rewrites a finished game.

## Types

Shared types live in `src/types/` (bulletproof-react: types used across features are
shared, not feature-scoped).

```ts
type Session = {
	id: string;                 // crypto.randomUUID()
	name: string;               // defaults to template name + date
	templateId: string;         // always set — counter mode is counter.json, not null
	mode: "sheet" | "tally";    // snapshot
	categories: Category[];     // snapshot; survives template changes
	win: "highest" | "lowest";  // snapshot
	targetScore?: number;       // snapshot
	tiebreakNote?: string;      // snapshot
	handTotal?: number;         // snapshot — advisory hand balance (tally only)
	entry?: "player" | "team"; // snapshot — labels only
	players: Player[];
	rounds: Round[];            // sheet mode: exactly one, forever
	status: "active" | "finished";
	createdAt: string;          // ISO 8601
	finishedAt?: string;
};

type Player = {
	id: string;
	name: string;               // may name a team, not just a person
	colorIndex: number;         // 1–12, indexes --player-01…12 in tokens.css
	sortOrder: number;          // seat order — the order players were added
};

// rounds[r][playerId][categoryKey] = raw entered value, before multiplier/divideBy
type Round = Record<string, Record<string, number>>;
```

**`colorIndex` is an index, not a colour.** It never stores a hex or an oklch value: the two
themes define twelve *different* colours under the same twelve names, re-derived rather than
reused (L 0.53 on paper, L 0.72 on dimmed paper), and a stored hex would be wrong in one of
them. Colours are assigned in palette order 1, 2, 3… as players are added — the first six
hues are pairwise distinct under protan/deutan/tritan, so front-loading is what makes a
six-player table readable. The rendered token always carries the player's initial; colour is
an index, never the identity.

**`sortOrder` is seat order and is never rewritten by scoring.** Rows hold their position
all evening — rank is displayed in the margin, not used to sort. Sorting happens exactly
once, on Results, and produces a derived list rather than a mutation. The only thing that
changes `sortOrder` is the user dragging a row at setup.

**One entry shape for both modes.** A sheet is a tally with exactly one round. This means
one scoring function, one persistence path, and one migration story rather than two of
each. `mode` governs only whether the UI may append a round.

### Deviations from `docs/ideas/scoresheet-first.md`

**1. Append-only `ScoreEvent` is cut.** The one-pager kept it from the original plan.
Specifying it showed it no longer pays for itself:

- Category entry is *cell assignment*, not deltas. Undo for a mistyped cell is retyping the
  cell. An event log adds a table, a replay function and a derived-state cache to support
  an interaction nobody performs.
- Counter mode does use deltas, but a session lasts one evening. *Superseded by the design
  pass:* counter mode ships as a one-category `tally` template, so a tick is a hand, the
  deltas are `rounds` and are persisted like every other hand, and the undo is `EDIT LAST`
  (`2a`) or the correctable cell grid (`2d`). There is no in-memory undo stack left to
  lose.
- History browsing ("scrollable, searchable score log") was already out of scope, and was
  the only feature the event log uniquely enabled.

**Cost:** none left. Every entry, in both modes, is persisted the moment it is typed.

**2. Rounds are back.** The one-pager cut per-round scoring as unnecessary
("flattening loses nothing at the final tally"). That holds for euros and is false for
card games — Uno, Belote, Whist and Black Lady are *entirely* cumulative across hands, and
the running tally is the thing players want. Rounds return as `tally` mode. The original
argument survives for `sheet` mode, where flattening is still correct.

Also removed from the original schema: `SessionParticipant`, `roomCode`, `hostId`,
`clientEventId`, and the `LOBBY`/`PAUSED` states — the latter two are timer concepts, and
there are no timers.

## Derived data — never stored

Computed on read, per `template-grammar.md`:

```
cellScore(v, cat) = Math.floor(v * (cat.multiplier ?? 1) / (cat.divideBy ?? 1))
roundScore(p, r)  = Σ cellScore(rounds[r][p][cat.key] ?? 0, cat)  for all cat
total(p)          = Σ roundScore(p, r)                            for all r
ranking           = players sorted by total, direction from session.win
tiedRanks         = players sharing a total → show tiebreakNote, resolve nothing
```

The design adds a second layer of derived values. None of these is stored either — they are
functions of the session and the player count, and storing any of them creates a stale copy:

```
rank(p)           = position in ranking; ties share a number and render a "=" suffix
leader            = rank 1 — labelled LEADS, or SAFEST when win = "lowest"
toGo(p)           = targetScore - total(p)          (tally, when targetScore is set)
racebar(p)        = clamp(total(p) / targetScore, 0, 1)
                    progress when win = "highest"; distance to bust when "lowest"
density           = players <= 3 ? "roomy" : players <= 6 ? "comfortable" : "compact"
handBalance(r)    = Σ over players of rounds[r][p][cat] — against Template.handTotal
targetPassed      = any player past targetScore — advisory only, never a state change
```

`density` is derived from player count at render time and nothing else. It is not a
preference, not a setting, and not persisted — a session that gains a late player gets
denser on the next render, which is the correct behaviour.

Missing entries read as `0`. A player with no entries scores `0` and ranks last, not
"unranked". A newly appended round is a legitimate empty object.

## Schema versioning

`meta.schemaVersion` holds an integer. On open, if the stored version is lower than the
app's, run ordered migration functions. v1 ships version `1` and no migrations — the
mechanism exists so the first real migration isn't a data-loss event.

## Durability

The single largest risk in the project (assumption 2 in the idea one-pager). Three
mitigations, all in v1 scope:

1. Call `navigator.storage.persist()` on first session creation. Log the boolean result;
   surface it if `false`.
2. Ship JSON export of all sessions from day one. Import accepts the same format and
   merges by `id`, skipping duplicates. Export writes `meta.lastExportedAt`, which the Home
   backup card renders as a live relative stamp (`4 DAYS AGO`, `NEVER` when unset) and
   turns `--color-advisory` past 14 days. That card sits **in the session list**, not behind
   a settings screen — it is the only backup that exists, and there is no settings screen to
   hide it in.
3. Prompt Add-to-Home-Screen — the only reliable way to survive Safari's ~7-day eviction
   of unused sites.

Card games raise the stakes here: a Belote session to 501 can span 15+ hands and a whole
evening, so mid-session data loss costs more than a single euro tally would.

## Recent player names

`meta.recentNames` holds a capped list (20) of recently used names, most-recent-first, for
fast setup on the second game night — they render as 40px tap-to-add pills under the setup
rows, so a repeat table is four taps. Team names ("Us", "Alice & Bob") land in the same list — the
model doesn't distinguish. Not profiles: no stats, no IDs, no merging. Just strings.

## Open questions

- Should finished sessions be immutable? Leaning yes — allow "reopen" as an explicit
  action rather than silent editing of history.
- Cap on stored sessions before prompting export? A session is < 2KB even with 20 rounds,
  so quota is unlikely to bind in practice.
- Does `tally` mode need to persist which round is "current", or is it always the last
  one? Always-last is simpler and probably right — and the design agrees: `2a`'s entry bar
  always reads `Enter hand N →` for the next hand, and older hands are corrected in the
  history grid rather than by making one of them current again.
- Session duplication (Home swipe → `Duplicate`) copies `templateId`, the category/win/
  target snapshot and `players` (names + `colorIndex`), and starts with an empty `rounds`.
  New `id`, new `createdAt`, `status: "active"`. Should the name carry a suffix, or open the
  rename field?
- Nothing outstanding on `handTotal` / `entry` — both are approved, snapshotted with the
  rest of the template, and advisory-only.
