# Board Game Counter - Feature List

## Core Features (MVP)

### 1. Game Session Management

Create, start, pause, and end game sessions. Each session tracks the game being played, participants, timestamps, and current state.

**States:** `lobby` > `active` > `paused` > `finished`

**Example flow:**

- User taps "New Game" and enters a name (e.g., "Friday Catan Night")
- Adds players to the lobby
- Taps "Start Game" to begin scoring
- Mid-game, someone needs a break: tap "Pause"
- When done, tap "End Game" to finalize scores and declare a winner

**Details:**

- A session stores: game name, creation date, start time, end time, status, and an optional link to a Game Template
- Pausing freezes any active timers
- Ending a session locks scores and computes final rankings
- Sessions can be abandoned (deleted without saving to history)

---

### 2. Player Management

Add and remove players within a session. Each player has a display name, an assigned color, and an optional avatar.

**Example:**

- Creating a session for 4 players: Alice (blue), Bob (red), Charlie (green), Dana (purple)
- Colors are auto-assigned from a palette but can be changed by tapping the color swatch
- Avatar can be an emoji, initials, or an uploaded image
- Reorder players by drag-and-drop to match seating order

**Details:**

- Support 2 to 20 players per session
- Player names must be unique within a session
- A "quick add" feature lets you pick from recently used player names
- Color palette: 12 distinct, accessible colors that work in both light and dark mode
- Players can be removed only while the session is in `lobby` state

---

### 3. Score Tracking

Increment or decrement points per player using tap-friendly controls. Display a live scoreboard sorted by current rank.

**Example:**

- Each player row shows: avatar, name, current score, and +/- buttons
- Default increment is +1, but a long-press reveals quick-pick values: +1, +2, +5, +10, or a custom input
- Tapping "+5" on Alice's row instantly updates her score from 12 to 17
- The scoreboard reorders in real-time: if Alice overtakes Bob, her row animates above his

**Details:**

- Scores can be negative (e.g., Agricola penalizes empty spaces)
- Custom increment buttons can be configured per session (e.g., a Catan game might use +1 only, while a party game might need +100)
- Score changes are animated to provide visual feedback
- A compact mode shows just names and scores for smaller screens
- Landscape mode displays a wider scoreboard layout

---

### 4. Score History / Undo

Every score change is logged with a timestamp and context. Users can undo the last action or revert any specific change.

**Example:**

- Score log shows:
  ```
  10:42 PM  Alice  +2  (12 -> 14)  "Longest Road"
  10:41 PM  Bob    +1  (8 -> 9)
  10:40 PM  Alice  -1  (13 -> 12)  "Correction"
  ```
- Swiping left on any entry reveals an "Undo" button
- Tapping "Undo" on the 10:42 entry reverts Alice's score from 14 back to 12
- A global "Undo last" button in the toolbar reverts the most recent change

**Details:**

- Each log entry stores: player, delta, score before, score after, timestamp, and an optional note
- Undo recalculates all subsequent scores if a mid-history entry is reverted
- Optional: attach a note to any score change (e.g., "Built a city", "Science combo")
- History is scrollable and searchable
- Bulk undo: revert all changes from a specific round

---

### 5. Multi-device Sync

Share a game session across multiple devices via a room code or shareable link. All participants see score updates in real-time.

**Example:**

- Host creates a game session and sees a 6-character room code: `ABC123`
- Other players open the app, tap "Join Game", and enter the code
- Alternatively, the host shares a link: `https://app.example.com/join/ABC123`
- When the host adds +2 to Alice's score, all connected devices update within 1-2 seconds
- If a player's phone loses connection, a "reconnecting..." banner appears; on reconnect, the state syncs automatically

**Details:**

- Real-time sync via WebSocket (with polling fallback for unreliable connections)
- Host has full control (add/remove players, start/pause/end game)
- Guests can be granted "scorer" permission to update scores, or remain view-only
- Room codes expire after 24 hours of inactivity
- Conflict resolution: last-write-wins with server timestamp, plus undo for corrections
- Latency indicator shows connection quality
- Works on the same Wi-Fi or across the internet

---

### 6. Offline Support

The app works without an internet connection. Game state is cached locally and syncs when connectivity is restored.

**Example:**

- Players are at a cabin with no Wi-Fi
- One player creates a local-only game session on their phone
- All scoring works normally: scores update, history logs, undo works
- Later, back in town, the app detects connectivity and offers to sync the session to the cloud
- If the user had an account, the game appears in their history

**Details:**

- PWA (Progressive Web App) with service worker for asset caching
- Local storage (IndexedDB) for game state persistence
- "Install app" prompt on supported browsers and devices
- Queued actions sync in order when back online
- Conflict resolution for sessions that were edited on multiple devices while offline
- Clear visual indicator of online/offline status
- Works for single-device sessions without any account or connectivity

---

## Enhanced Features (v1.1)

### 7. Game Templates

Predefined scoring configurations for popular board games. Templates define player count limits, score categories, round structure, and special scoring rules.

**Example templates:**

- **Catan:** min 3 / max 6 players, single score track, first to 10 wins
- **7 Wonders:** 7 rounds (ages), categories: military, treasury, wonders, civic, science, commerce, guilds
- **Terraforming Mars:** categories: TR track, awards, milestones, greenery, cities, cards
- **Wingspan:** 4 rounds, categories: birds, bonus cards, end-of-round goals, eggs, food on cards, tucked cards

**Details:**

- Ship with 20+ built-in templates for popular games
- Templates are versioned and can be updated without losing saved sessions
- Community templates: users can share their templates via export/import
- A template defines: name, icon/image, min/max players, scoring categories, number of rounds (optional), win condition (highest score, target score, lowest score)

---

### 8. Round-based Scoring

For games that are scored round by round. Enter scores per round and see automatic running totals.

**Example (Wingspan - 4 rounds):**

```
           Round 1  Round 2  Round 3  Round 4  Total
Alice         12       18       22       15      67
Bob           15       14       25       20      74
Charlie        9       20       19       24      72
```

- After each round, a "Score Round" dialog appears for each player
- Running totals update automatically
- Visual chart shows score progression across rounds

**Details:**

- Configurable number of rounds (or unlimited for open-ended games)
- Score entry per round can be a single value or broken into categories
- "Current round" indicator with navigation to review past rounds
- Option to lock completed rounds to prevent accidental edits
- Round summary shows deltas and rank changes

---

### 9. Category Scoring

Break scores into named categories for games with multi-dimensional scoring. Show a detailed breakdown alongside the total.

**Example (7 Wonders final scoring):**

```
            Military  Treasury  Wonders  Civic  Science  Commerce  Guilds  Total
Alice           12        3        10     18      26        4        5      78
Bob              6        7        15     21      10        8       11      78
Charlie         18        1         5     24      13        6        3      70
```

- Each category has its own color for visual distinction
- Tie-breaking: Treasury (coins) breaks ties in 7 Wonders; the app resolves this automatically
- A pie/bar chart shows the score distribution per player

**Details:**

- Categories are defined by the game template or created ad-hoc
- Scores per category can be entered in any order
- Auto-sum computes the total from all categories
- Category-level statistics: "Who scored highest in Science?"
- Supports both positive and negative categories (e.g., Agricola's "unused spaces" is always negative)

---

### 10. Timer / Turn Tracker

Optional chess-clock-style timer to track time per turn. Visual indicator highlights the active player.

**Example:**

- In a 4-player game, the active player's card is highlighted with a glowing border
- A countdown timer shows "1:30 remaining" (or counts up if no limit is set)
- When time expires, a gentle vibration and sound notify the player
- Tapping "Next Turn" advances to the next player and starts their timer
- At end of game, a breakdown shows total thinking time per player

**Details:**

- Timer modes: count-up (track time), count-down (enforce limits), or disabled
- Configurable time per turn (30s, 1min, 2min, 5min, custom)
- Optional "bonus time" bank (like Fischer chess clock)
- Auto-advance option: automatically move to the next player when time expires
- Turn order can follow seating order or be manual
- Pause button freezes all timers

---

### 11. Score Calculators

Built-in calculators that help compute complex scoring formulas for specific games.

**Example (7 Wonders Science scoring):**

- Player enters: 3 compasses, 2 tablets, 4 gears
- Calculator shows:
  ```
  Sets of 3 different: 2 sets x 7 = 14
  Compass:  3^2 = 9
  Tablet:   2^2 = 4
  Gear:     4^2 = 16
  Total science: 43
  ```
- Result is automatically applied to the Science category

**Example (Agricola negative scoring):**

- Player marks: 0 grain, 1 vegetable, 3 sheep, 0 cattle, 2 rooms (wood), 5 fields
- Calculator applies the Agricola scoring table and shows: +3 fields, -1 grain, +1 vegetable, +1 sheep, -1 cattle, etc.

**Details:**

- Calculators are bundled with game templates
- Support formulas: addition, multiplication, exponents, lookup tables, min/max
- "What-if" mode: try different inputs before committing the score
- Calculators can be used standalone outside of a game session

---

### 12. Game Library

A personal collection of game definitions. Users can create, edit, and organize their own games with custom scoring rules.

**Example:**

- User creates a new game: "Our House Rules Uno"
  - Min players: 2, Max players: 8
  - Scoring: single track, lowest score wins
  - Custom increments: +5, +10, +20, +50
  - Icon: card emoji
- The game appears in their library alongside built-in templates
- When starting a new session, they pick from the library

**Details:**

- Search and filter games by name, player count, or tags
- Tags: "strategy", "party", "card game", "cooperative", etc.
- Favorite games appear at the top of the list
- Import/export game definitions as JSON
- Duplicate and modify existing templates to create variants
- Track how many times each game has been played

---

## Social & Persistence (v1.2)

### 13. Player Profiles

Persistent profiles that track a player's history across all game sessions.

**Example profile for Alice:**

```
Games played:     47
Wins:             18 (38%)
Favorite game:    7 Wonders (played 12 times)
Best game:        Wingspan (avg score: 72)
Current streak:   3 wins
```

**Details:**

- Profiles are local-first (no account required)
- Optional cloud sync with account
- Profile shows: total games, win rate, per-game stats, recent activity
- "Rivals" section shows head-to-head records against other players
- Merge duplicate profiles if the same person was entered with different names

---

### 14. Game History

Browse and search past game sessions with full details.

**Example:**

```
Friday Catan Night - March 15, 2026
  Game:     Catan
  Players:  Alice (10 VP - Winner), Bob (8 VP), Charlie (7 VP)
  Duration: 1h 23m
  Notes:    "Epic comeback by Alice with Longest Road"
```

**Details:**

- Filter by: game type, player, date range, winner
- Sort by: date, duration, score
- Tap a session to see full score breakdown, round-by-round data, and score history log
- Add notes or photos to past sessions
- Delete or archive old sessions
- Export history as CSV or JSON

---

### 15. Statistics & Leaderboards

Aggregate statistics and visual leaderboards across all recorded sessions.

**Example leaderboard:**

```
All-time Wins:
  1. Alice    18 wins (38% win rate)
  2. Bob      15 wins (32% win rate)
  3. Charlie  12 wins (26% win rate)
```

**Details:**

- Global stats: total games played, total hours, most played game
- Per-player stats: win rate, average score per game, highest score ever
- Per-game stats: average game duration, average winning score, most common winner
- Charts: win rate over time, score trends, game frequency
- Filters: by date range, game type, player group
- "Game night" grouping: cluster sessions from the same evening

---

## Nice-to-Haves (v2+)

### 16. Dice Roller

Built-in dice roller with configurable dice types and roll history.

**Example:**

- Tap the dice icon, select 2d6, shake the phone or tap "Roll"
- Animated dice show the result: 4 + 3 = 7
- Roll history: "7, 11, 5, 8, 6..."

**Details:**

- Dice types: d4, d6, d8, d10, d12, d20, d100, custom
- Roll multiple dice at once (e.g., 3d6 + 1d8)
- Modifiers: +2, -1, etc.
- Roll history with statistics (average, distribution chart)
- Shake-to-roll with phone accelerometer
- Fairness indicator: shows if results deviate significantly from expected distribution

---

### 17. Random Player Order

Randomize player seating or turn order with fun animations.

**Example:**

- Tap "Randomize Order" in the lobby
- A spinning wheel or shuffling animation plays
- New order is revealed: Charlie, Alice, Dana, Bob
- "First player" badge is assigned to Charlie

**Details:**

- Shuffle animation options: wheel spin, card flip, slot machine
- Lock specific positions (e.g., "Alice always goes first")
- History of past orderings to avoid repeats
- Coin flip and random number generator as bonus tools

---

### 18. Score Photos

Attach photos to game sessions to capture the final board state or memorable moments.

**Example:**

- At end of game, a "Take Photo" button appears
- Snap a picture of the final board state
- Photo is saved alongside the session in game history
- Browsing history shows thumbnail previews

**Details:**

- Camera integration or upload from gallery
- Multiple photos per session
- Optional captions
- Photos stored locally with cloud sync option
- Compress images to save storage

---

### 19. Export / Share Results

Share final game results with friends or export data for external analysis.

**Example:**

- After ending a game, tap "Share Results"
- Choose format: image card, text summary, or raw data
- Image card shows a styled scoreboard graphic with player names, scores, and winner
- Share via system share sheet (WhatsApp, iMessage, Discord, etc.)

**Details:**

- Export formats: PNG image, PDF, CSV, JSON
- Shareable link that displays results in a web page
- Customizable share card theme
- Bulk export: all history as CSV for spreadsheet analysis
- Integration with social platforms (optional)

---

### 20. Themes / Customization

Personalize the app's appearance with themes, colors, and sound effects.

**Example:**

- Built-in themes: "Ocean" (blue tones), "Forest" (green), "Dungeon" (dark stone), "Neon" (bright accents)
- Toggle dark/light mode (already implemented)
- Sound effects: subtle click on score change, fanfare on game end, tick on timer

**Details:**

- Theme affects: background, card colors, accent colors, typography
- Per-game themes: Catan gets warm earth tones, 7 Wonders gets ancient stone
- Sound effects can be toggled on/off
- Haptic feedback on score changes (mobile)
- Accessibility: high contrast mode, larger text option

---

### 21. i18n (Internationalization)

Multi-language support leveraging the existing Paraglide setup.

**Example:**

- App detects browser language and defaults to French
- User can switch language in settings: English, French, German, Spanish, Japanese...
- All UI labels, buttons, game template names, and error messages are translated
- Number formatting respects locale (1.000 vs 1,000)

**Details:**

- Leverage existing Paraglide i18n infrastructure
- Priority languages: English, French, German, Spanish
- Localized date and time formatting
- RTL support for Arabic/Hebrew (future)
- Community translations via contribution workflow
- Game template names and descriptions are translatable
