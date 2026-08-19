# Spec: Scoresheet Template Grammar

The load-bearing artifact. A template is data, never code. One generic renderer draws any
template. Adding a game costs zero code.

## Design constraint

Every field must be justified by at least two seed games. Anything needed by exactly one
game is dropped, deferred, or explicitly argued for. This is what stops the grammar
becoming a programming language.

## Two shapes, one model

| Mode | Shape | Games |
|---|---|---|
| `sheet` | Many categories, scored **once** at the end | Euros: Wingspan, Azul, 7 Wonders… |
| `tally` | One or few categories, scored **every hand**, accumulating | Card games: Uno, Belote, Whist, Black Lady |

These are not two data models. **A sheet is a tally with exactly one round.** Entries are
always `Round[]`; sheet mode simply has `rounds.length === 1` and never grows. One shape,
one scoring function, one renderer branch.

`mode` exists only to say whether the user may add rounds.

## Schema v0

```ts
type Template = {
	id: string;                 // stable slug, filename must match
	name: string;               // display name, not translated (proper noun)
	players: [number, number];  // [min, max] inclusive
	mode: "sheet" | "tally";
	categories: Category[];     // 1..n, order is entry order
	win: "highest" | "lowest";
	targetScore?: number;       // game-ending threshold, advisory only
	setupNote?: string;         // shown at player setup, e.g. "one entry per team"
	tiebreakNote?: string;      // shown on results when ranks tie; no logic

	// ---- added by the design pass ----
	entry?: "player" | "team";  // default "player" — labels the setup screen, nothing else
	handTotal?: number;         // tally: points a hand always distributes. ADVISORY
};

type Category = {
	key: string;                // unique within template, stable
	label: string;              // translatable
	multiplier?: number;        // non-zero integer, default 1
	divideBy?: number;          // positive integer, default 1
	hint?: string;              // optional entry help, translatable
};
```

### Scoring rule (complete)

```
cellScore(value, cat) = Math.floor(value * (cat.multiplier ?? 1) / (cat.divideBy ?? 1))
roundScore(p, r)      = Σ cellScore(rounds[r][p][cat.key] ?? 0, cat)  for all cat
playerTotal(p)        = Σ roundScore(p, r)                            for all r
rank                  = sort by playerTotal, desc if win="highest", asc if win="lowest"
```

`multiplier` and `divideBy` are **always integers**, and `Math.floor` is applied
unconditionally. Floor is the only rounding board and card games use, so this needs no
rounding configuration.

**Never express division as a fractional multiplier.** An earlier draft used
`multiplier: 0.3333` for 7 Wonders coins; it is wrong at the first case (3 coins scored 0
instead of 1) and diverges from the correct answer 66 times between 0 and 200. Exact
integer arithmetic is the only safe form — enforced by validation and a regression test.

These two fields are the only computation in the grammar, earning their place across five
seed games (Catan ×2, Azul ×2/×7/×10, Ticket to Ride ×-1, Splendor ×3, 7 Wonders ÷3).
Negative multipliers make a separate "negative category" flag unnecessary — this resolves
open question 2 in `../ideas/scoresheet-first.md`.

`divideBy` is used by exactly one seed game, breaking the two-game rule. Kept anyway: it
is the denominator of a mechanism already present, not a new concept, and the alternative
is either floating-point wrongness or mental arithmetic at the exact moment the app exists
to prevent it.

### The two fields the design pass added

Both were raised as "ask first" and both are approved. Neither touches scoring.

**`entry: "player" | "team"`** (default `"player"`) — `1i` titles the setup screen
`Équipes`, counts `2 / 2` teams, and reads "chaque ligne est une équipe". Nothing else in
the grammar tells the UI that Belote's two entries are teams rather than two people, and
the alternative — inferring it from `players[0] === players[1] === 2` — is wrong for the
first 2-player game that isn't a partnership. Justified by two seed games (Belote, Whist),
so it clears the two-game rule. **It changes nouns, nothing else:** no scoring branch, no
data-model change, and still **no team concept** — a team is one scoring entry whose name
happens to hold two people. Set `"team"` on `belote.json` and `whist.json`.

**`handTotal: number`** — the points a hand always distributes; `tally` only. Black Lady
sets `26`. `2c` renders the live check in its header
(`MANCHE 9 · 26 À RÉPARTIR · 7 PLACÉS`), and the app **saves the hand regardless**.

> **Advisory, not blocking** — this is a deliberate departure from the handoff, which
> refuses to save until the hand balances. Blocking refuses legal play: Black Lady's own
> `setupNote` covers shooting the moon, which scores 26 to *each* opponent (a hand
> totalling 26 × (n − 1)) or −26 to the shooter. Both are correct and both fail the check.
> The counter earns its place by doing the arithmetic nobody wants to do at the table; it
> does not get to argue with the table. Render the imbalance in `--color-advisory-*`, like
> every other non-blocking notice in the app.

### `targetScore` semantics

The score at which the game **ends**, not the score that wins. For `win: "highest"` the
player reaching it usually wins (Uno 500, Belote 501); for `win: "lowest"` the player
reaching it usually *loses* (Black Lady 100). The app never enforces it — house rules vary
too much (Belote is played to 501, 1000 or 2000 depending on the table). It marks the
crossing and stays out of the way.

### Teams

There is no team concept, and the design pass did not introduce one — `1i` shows Belote as
two rows, `2 / 2`, blocking only on duplicate names. The proposed `entry: "team"` field
above changes the setup screen's *nouns* and nothing else. Belote and Whist are
`players: [2, 2]` with a `setupNote` telling the user to enter one row per team. Two teams are two scoring entries; naming them
"Us"/"Them" or "Alice & Bob" is the user's business. This costs zero code and covers every
partnership game.

### Deliberately absent

| Not in v0 | Why | Revisit when |
|---|---|---|
| Formulas / expressions | Needed by exactly one category in one game (7 Wonders science) | A second game needs it |
| Automatic tiebreak resolution | Every seed game breaks ties differently, and Splendor's rule (fewest cards) isn't a scoring category at all | Probably never — `tiebreakNote` gives full information for zero logic |
| Team/partnership modelling | Two teams are two entries | A game needs per-player *and* per-team scores simultaneously |
| Per-round category variation | No seed game changes its categories between rounds | A game does |
| Round labels / named rounds | "Hand 1, 2, 3…" is positional | Someone needs "Age I/II/III" |
| Dealer rotation, contracts, bids | Belote/Whist bidding is game state, not scoring | Never in v1 — this is a scorepad, not a game engine |
| Icons / colours per category | The design gives categories a mono 3-letter chip in the strip (`MIL TRS WND`) and no colour of their own. The chip is derived from the translated `label` at render time (see `SPEC.md` §4) — no `abbr` field — accent marks *position in the sequence*, not the category | Never. Colour is reserved for players and the two signals |
| Cover art per template | The shelf (`1f`) generates its tile art from `name` — no image assets in v1, no field, no asset pipeline (see `SPEC.md` §2) | Real box art ships, and then it is an asset resolved by `id`, still not a grammar field |

## Validation rules

A template is invalid, and must fail a build-time test, if:

- `id` doesn't match its filename stem
- `categories` is empty, or two categories share a `key`
- `players[0] < 1` or `players[1] < players[0]`
- `multiplier` is `0` or not an integer
- `divideBy` is `0`, negative, or not an integer
- any `key` fails `^[a-z][a-z0-9_]*$`
- `mode` is `"sheet"` and a session built from it has `rounds.length !== 1`

- `handTotal` is not a non-zero integer, or is set on a `sheet` template
- `entry` is a value other than `"player"` or `"team"`

## Variants: the honest caveat

**Each template encodes one common variant, not the truth.** Whist alone has partnership,
knock-out and Oh Hell forms. Belote is played to 501 or 1000. Uno's official rule is that
the winner banks the losers' cards; many tables play the inverse. Hearts tables disagree
about shooting the moon.

Every template therefore states its encoded variant in `setupNote` or `hint`. This is the
strongest argument for user-authored templates, and the reason the grammar must exist from
day one even though the authoring UI does not.

## Seed templates — board games

### Catan — `catan.json`

```json
{
  "id": "catan",
  "name": "Catan",
  "players": [3, 6],
  "mode": "sheet",
  "win": "highest",
  "targetScore": 10,
  "categories": [
    { "key": "settlements",  "label": "Settlements",   "multiplier": 1 },
    { "key": "cities",       "label": "Cities",        "multiplier": 2 },
    { "key": "longest_road", "label": "Longest road",  "multiplier": 2, "hint": "1 if held, else 0" },
    { "key": "largest_army", "label": "Largest army",  "multiplier": 2, "hint": "1 if held, else 0" },
    { "key": "vp_cards",     "label": "Victory point cards", "multiplier": 1 }
  ]
}
```

### Splendor — `splendor.json`

```json
{
  "id": "splendor",
  "name": "Splendor",
  "players": [2, 4],
  "mode": "sheet",
  "win": "highest",
  "targetScore": 15,
  "tiebreakNote": "Fewest development cards wins.",
  "categories": [
    { "key": "cards",  "label": "Prestige from cards" },
    { "key": "nobles", "label": "Nobles", "multiplier": 3 }
  ]
}
```

### Wingspan — `wingspan.json`

```json
{
  "id": "wingspan",
  "name": "Wingspan",
  "players": [1, 5],
  "mode": "sheet",
  "win": "highest",
  "tiebreakNote": "Most unused food tokens wins.",
  "categories": [
    { "key": "birds",  "label": "Birds" },
    { "key": "bonus",  "label": "Bonus cards" },
    { "key": "goals",  "label": "End-of-round goals" },
    { "key": "eggs",   "label": "Eggs" },
    { "key": "food",   "label": "Food on cards" },
    { "key": "tucked", "label": "Tucked cards" }
  ]
}
```

Four rounds flattened to end-game categories — correct here, and exactly what `tally` mode
exists to *not* do for card games.

### Azul — `azul.json`

```json
{
  "id": "azul",
  "name": "Azul",
  "players": [2, 4],
  "mode": "sheet",
  "win": "highest",
  "tiebreakNote": "Most complete horizontal rows wins.",
  "categories": [
    { "key": "board",   "label": "Score from board track" },
    { "key": "rows",    "label": "Complete rows",    "multiplier": 2 },
    { "key": "columns", "label": "Complete columns", "multiplier": 7 },
    { "key": "colors",  "label": "Complete colours", "multiplier": 10, "hint": "All 5 tiles of one colour" }
  ]
}
```

### Ticket to Ride — `ticket-to-ride.json`

```json
{
  "id": "ticket-to-ride",
  "name": "Ticket to Ride",
  "players": [2, 5],
  "mode": "sheet",
  "win": "highest",
  "tiebreakNote": "Most completed destination tickets wins.",
  "categories": [
    { "key": "routes",           "label": "Route points" },
    { "key": "tickets_complete", "label": "Completed tickets" },
    { "key": "tickets_failed",   "label": "Uncompleted tickets", "multiplier": -1, "hint": "Enter the total as a positive number" },
    { "key": "longest_path",     "label": "Longest continuous path", "multiplier": 10, "hint": "1 if held, else 0" }
  ]
}
```

`multiplier: -1` is the whole negative-category feature.

### 7 Wonders — `7-wonders.json`

```json
{
  "id": "7-wonders",
  "name": "7 Wonders",
  "players": [3, 7],
  "mode": "sheet",
  "win": "highest",
  "tiebreakNote": "Most coins wins.",
  "categories": [
    { "key": "military",   "label": "Military conflicts" },
    { "key": "treasury",   "label": "Coins", "divideBy": 3, "hint": "Enter your coin count; 3 coins = 1 point" },
    { "key": "wonders",    "label": "Wonder stages" },
    { "key": "civilian",   "label": "Civilian structures" },
    { "key": "science",    "label": "Science", "hint": "n² per symbol type, +7 per set of three — enter the total yourself" },
    { "key": "commercial", "label": "Commercial structures" },
    { "key": "guilds",     "label": "Guilds" }
  ]
}
```

**Partially fits — the known gap.** Six of seven categories are exact. `science` is entered
manually because n₁²+n₂²+n₃²+7×sets is irreducible to multiplication. Contained to one
category in one game; it does **not** justify a formula engine. The trigger for revisiting
is a *second* game needing computation.

## Seed templates — card games

Card games are what forced `tally` mode into the grammar. Every one of them is a running
total across hands, which is the opposite of the euro end-game tally.

### Uno — `uno.json`

```json
{
  "id": "uno",
  "name": "Uno",
  "players": [2, 10],
  "mode": "tally",
  "win": "highest",
  "targetScore": 500,
  "setupNote": "Official scoring: the player who goes out banks the value of everyone else's remaining cards. First to 500 wins.",
  "categories": [
    { "key": "points", "label": "Points won", "hint": "Number cards face value · action cards 20 · wilds 50" }
  ]
}
```

### Black Lady — `black-lady.json`

```json
{
  "id": "black-lady",
  "name": "Black Lady",
  "players": [3, 6],
  "mode": "tally",
  "win": "lowest",
  "targetScore": 100,
  "handTotal": 26,
  "setupNote": "Hearts variant with the Queen of Spades. Lowest score wins; the game ends when someone reaches 100.",
  "categories": [
    { "key": "penalty", "label": "Penalty points", "hint": "1 per heart, 13 for the Queen of Spades. Shooting the moon: 26 to each opponent, or −26 to yourself." }
  ]
}
```

The only seed template using `win: "lowest"`, and the only one with a `handTotal` — 13
hearts plus 13 for the Queen. The counter is advisory: shooting the moon breaks the total
on purpose, and the app lets it.

The only seed template using `win: "lowest"`. Before card games were added, that branch of
the scoring rule was specified but never exercised by real data.

### Belote — `belote.json`

```json
{
  "id": "belote",
  "name": "Belote",
  "players": [2, 2],
  "mode": "tally",
  "win": "highest",
  "targetScore": 501,
  "entry": "team",
  "setupNote": "Belote classique, two teams: enter one row per team, not per player. Played to 501 here; adjust if your table plays to 1000.",
  "categories": [
    { "key": "hand", "label": "Hand points", "hint": "Card points, declarations and 10 de der combined" }
  ]
}
```

### Whist — `whist.json`

```json
{
  "id": "whist",
  "name": "Whist",
  "players": [2, 2],
  "mode": "tally",
  "win": "highest",
  "targetScore": 5,
  "entry": "team",
  "setupNote": "Partnership whist, two teams: enter one row per team, not per player. Knock-out and Oh Hell variants score differently.",
  "categories": [
    { "key": "tricks", "label": "Points", "hint": "One point per trick taken above six" }
  ]
}
```

## Storage & loading

- Templates live in `src/lib/templates/*.json`, imported statically and bundled — no fetch,
  no runtime loading, no network.
- `registry.ts` re-exports them as a typed, frozen array. Import JSON files directly rather
  than through a barrel, per bulletproof-react's tree-shaking guidance.
- Users cannot author templates in v1. The grammar exists so they can later without a
  rewrite; the authoring UI does not.

## Open questions

- Does any planned game need `divideBy` with a non-1 `multiplier` (e.g. 2 points per 3
  items)? The rule supports it; no seed game exercises it, so it is untested against
  reality.
- Should `tally` mode cap rounds? Belote to 501 can run 15+ hands. Unbounded is simpler and
  a session record stays small.
- ~~Do card games want a per-round running-total column, or only the grand total?~~
  **Answered by the design pass: both, on different screens.** Standings (`2a`) show the
  grand total per player with the last hand's delta on a mono sub-line; the per-hand ledger
  moved to its own screen (`2d`), which offers `Per hand | Running` as a segmented control.
  At ≤ 3 players the last six hands also appear inline under the standings (`2e`). No
  grammar change — every view is derived from `rounds`.
- `counter.json` is a new seed template (`tally`, one category `points`, no `targetScore`,
  `players: [1, 12]`) so that counter mode is a tile on the shelf rather than an eleventh
  code path. Needs the same fixture test as the rest. Does it want `±` prominence the other
  tally games don't need?
- ~~Does the shelf's `Add a custom game` (`1g`) ship in v1?~~ **No — cut.** `1g` offers
  `Clear filter`. The grammar stays public-ready so the authoring UI can land later; when it
  does, this section is what it writes against.
