# User Interface

## Design System

- **Component library:** HeroUI (already installed) - provides accessible, themeable React components
- **Icons:** Lucide React (already installed)
- **Styling:** Tailwind CSS 4 with utility-first approach
- **Typography:** System font stack via Tailwind defaults
- **Dark mode:** Supported via Tailwind `dark:` variants and HeroUI theme

## Screen Map

```
Home (/)
  ├── New Game (/sessions/new)
  │     └── Lobby (/sessions/:id/lobby)
  │           └── Game (/sessions/:id/play)
  │                 ├── Scoreboard (default tab)
  │                 ├── History (tab)
  │                 └── Results (/sessions/:id/results)
  └── Join Game (/join)
        └── Lobby (/sessions/:id/lobby)
```

## Route Structure

```typescript
// src/routes.ts
rootRoute("root.layout.tsx", [
  index("home.page.tsx"),
  route("sessions/new", "sessions/new.page.tsx"),
  route("sessions/$sessionId/lobby", "sessions/lobby.page.tsx"),
  route("sessions/$sessionId/play", "sessions/play.page.tsx"),
  route("sessions/$sessionId/results", "sessions/results.page.tsx"),
  route("join", "join.page.tsx"),
  route("join/$roomCode", "join.page.tsx"),
]);
```

## Screen Details

### 1. Home Screen (`/`)

The landing page. Simple and action-oriented.

```
┌─────────────────────────────┐
│        Board Game Counter   │
│                             │
│   Track scores for any      │
│   board game, anywhere.     │
│                             │
│  ┌────────────────────────┐ │
│  │     + New Game         │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │     Join Game          │ │
│  └────────────────────────┘ │
│                             │
│  Recent Games               │
│  ┌────────────────────────┐ │
│  │ Friday Catan Night     │ │
│  │ 4 players · Finished   │ │
│  ├────────────────────────┤ │
│  │ Quick Wingspan         │ │
│  │ 3 players · Paused     │ │
│  └────────────────────────┘ │
│                             │
│         [🌐 EN ▾]           │
└─────────────────────────────┘
```

**Components:**

- `HeroButton` for primary actions
- `SessionCard` - custom card showing session name, player count, status badge
- Language switcher (Paraglide)

### 2. New Game Screen (`/sessions/new`)

Create a new game session.

```
┌─────────────────────────────┐
│  ← Back       New Game      │
│                             │
│  Game Name                  │
│  ┌────────────────────────┐ │
│  │ Friday Catan Night     │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │     Create Game        │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Behavior:**

- Single input for game name (required, max 100 chars)
- On submit: creates session in LOBBY status, navigates to lobby
- Minimal - more options come in v1.1 (templates, custom increments)

### 3. Lobby Screen (`/sessions/:id/lobby`)

Add players before starting the game.

```
┌─────────────────────────────┐
│  ← Back       Lobby         │
│                             │
│  Friday Catan Night         │
│  Room: ABC123  [Copy]       │
│                             │
│  Players (3/20)             │
│  ┌────────────────────────┐ │
│  │ 🔵 Alice          [✕]  │ │
│  │ 🔴 Bob            [✕]  │ │
│  │ 🟢 Charlie        [✕]  │ │
│  └────────────────────────┘ │
│                             │
│  ┌─────────────┐ ┌───────┐  │
│  │ Player name │ │  Add  │  │
│  └─────────────┘ └───────┘  │
│                             │
│  ┌────────────────────────┐ │
│  │    Start Game  (3+)    │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Components:**

- `PlayerListItem` - color dot, name, remove button (drag handle for reorder)
- Add player input + button
- Room code display with copy-to-clipboard button
- Start Game button (enabled when 2+ players)

**Behavior:**

- Players can be reordered by drag-and-drop
- Colors auto-assigned from palette, tap to change
- Room code generated on session creation (always, for easy sharing later)
- Remove player: only in LOBBY state

### 4. Game Screen (`/sessions/:id/play`)

The core scoring interface. Two tabs: Scoreboard and History.

#### Scoreboard Tab (default)

```
┌─────────────────────────────┐
│  Friday Catan Night  [⏸][⏹] │
│                             │
│  [Scoreboard]  [History]    │
│  ━━━━━━━━━━━━               │
│                             │
│  ┌────────────────────────┐ │
│  │ 🟢 Charlie        17   │ │
│  │        [-] [+1] [+5]   │ │
│  ├────────────────────────┤ │
│  │ 🔵 Alice          14   │ │
│  │        [-] [+1] [+5]   │ │
│  ├────────────────────────┤ │
│  │ 🔴 Bob             9   │ │
│  │        [-] [+1] [+5]   │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │     ↩ Undo Last        │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Components:**

- `ScoreCard` - player color, name, current score (large font), increment buttons
- `IncrementButton` - tap for default value, long-press for custom input
- `UndoButton` - reverts last score event
- Pause/End game buttons in header

**Behavior:**

- Scoreboard is **sorted by score descending** (rank order)
- When a score changes, the card animates to its new position
- Quick increment buttons: -1, +1, +5 (configurable per session in v1.1)
- Long-press on any increment button opens a number input dialog
- Scores can go negative

#### History Tab

```
┌─────────────────────────────┐
│  Friday Catan Night  [⏸][⏹] │
│                             │
│  [Scoreboard]  [History]    │
│                 ━━━━━━━━━   │
│                             │
│  10:42 PM                   │
│  🟢 Charlie  +2  (15 → 17)  │
│     "Built a city"    [↩]   │
│                             │
│  10:41 PM                   │
│  🔴 Bob      +1  (8 → 9)    │
│                       [↩]   │
│                             │
│  10:40 PM                   │
│  🔵 Alice    -1  (15 → 14)  │
│     "Correction"      [↩]   │
│                             │
│  10:38 PM                   │
│  🔵 Alice    +5  (10 → 15)  │
│     "Longest Road"    [↩]   │
│                             │
└─────────────────────────────┘
```

**Components:**

- `ScoreEventItem` - timestamp, player color/name, delta, before/after, optional note, undo button
- Reverted events shown with strikethrough and dimmed styling
- Infinite scroll or virtual list for long histories

### 5. Results Screen (`/sessions/:id/results`)

Shown when the game ends.

```
┌─────────────────────────────┐
│         Game Over!          │
│                             │
│  Friday Catan Night         │
│  Duration: 1h 23m           │
│                             │
│  🏆                         │
│  ┌────────────────────────┐ │
│  │ 1. 🟢 Charlie     17   │ │
│  │ 2. 🔵 Alice       14   │ │
│  │ 3. 🔴 Bob          9   │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │     New Game           │ │
│  └────────────────────────┘ │
│  ┌────────────────────────┐ │
│  │    Back to Home        │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

### 6. Join Game Screen (`/join`)

Enter a room code to join an existing session.

```
┌─────────────────────────────┐
│  ← Back      Join Game      │
│                             │
│  Enter the room code shared │
│  by the game host.          │
│                             │
│  ┌────────────────────────┐ │
│  │    A B C 1 2 3         │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │       Join             │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

**Behavior:**

- 6-character input, uppercase alphanumeric
- On submit: validates room code, navigates to lobby as a guest
- Deep link support: `/join/ABC123` auto-fills the code

## Component Hierarchy

```
App
├── RootLayout
│   ├── Header (game name, pause/end controls - context-dependent)
│   └── <Outlet />
│
├── HomePage
│   ├── HeroSection (title, tagline)
│   ├── ActionButtons (New Game, Join Game)
│   ├── RecentSessionsList
│   │   └── SessionCard[]
│   └── LanguageSwitcher
│
├── NewGamePage
│   └── NewGameForm (name input, submit)
│
├── LobbyPage
│   ├── SessionHeader (name, room code)
│   ├── PlayerList
│   │   └── PlayerListItem[] (sortable)
│   ├── AddPlayerForm
│   └── StartGameButton
│
├── PlayPage
│   ├── TabBar (Scoreboard | History)
│   ├── ScoreboardTab
│   │   ├── ScoreCard[] (sorted by rank, animated)
│   │   │   └── IncrementButtons
│   │   └── UndoButton
│   └── HistoryTab
│       └── ScoreEventItem[] (virtual list)
│
├── ResultsPage
│   ├── WinnerBanner
│   ├── FinalRankings
│   └── ActionButtons (New Game, Home)
│
└── JoinPage
    └── RoomCodeInput + JoinButton
```

## Responsive Strategy

| Breakpoint          | Layout                                                    |
| ------------------- | --------------------------------------------------------- |
| Mobile (<640px)     | Single column, full-width cards, bottom-aligned actions   |
| Tablet (640-1024px) | Wider cards, more padding, side-by-side increment buttons |
| Desktop (>1024px)   | Centered max-width container (640px), comfortable spacing |

The app is **mobile-first** since most board game scoring happens on phones at the table.

## Animation & Feedback

| Interaction   | Animation                                      |
| ------------- | ---------------------------------------------- |
| Score change  | Score number pulses + color flash              |
| Rank change   | Card slides to new position (layout animation) |
| Undo          | Reverted event fades and gets strikethrough    |
| Add player    | Card slides in from bottom                     |
| Remove player | Card slides out to the right                   |
| Tab switch    | Horizontal slide transition                    |

Use `framer-motion` or CSS `View Transitions API` for animations. Start simple with CSS transitions and upgrade if needed.

## Accessibility

- All interactive elements are keyboard-navigable
- Score changes announced via `aria-live` region
- Color indicators always paired with text (not color-only)
- Touch targets minimum 44x44px
- HeroUI components provide ARIA attributes out of the box
