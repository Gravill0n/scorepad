# Data Schema

## Design Principles

1. **Event-sourced scores** - Score changes are stored as immutable events, not mutable totals
2. **UUIDs everywhere** - All primary keys are UUIDs for offline-safe ID generation
3. **Soft state derivation** - Current scores, rankings, and totals are computed from events
4. **Timestamps on everything** - Every record has `createdAt`/`updatedAt` for sync ordering

## Entity Relationship Diagram

```
GameSession (1) ----< (N) Player
GameSession (1) ----< (N) ScoreEvent
Player      (1) ----< (N) ScoreEvent
GameSession (1) ----< (N) SessionParticipant (for multi-device)
```

## Prisma Models

### GameSession

The central entity representing a single game being played.

```prisma
model GameSession {
  id          String        @id @default(uuid()) @db.Uuid
  name        String        @db.VarChar(100)
  status      SessionStatus @default(LOBBY)
  roomCode    String?       @unique @db.VarChar(6)
  hostId      String?       @db.VarChar(64) // client fingerprint of the host
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  startedAt   DateTime?
  pausedAt    DateTime?
  finishedAt  DateTime?

  players      Player[]
  scoreEvents  ScoreEvent[]
  participants SessionParticipant[]

  @@index([roomCode])
  @@index([status])
  @@index([createdAt])
}

enum SessionStatus {
  LOBBY
  ACTIVE
  PAUSED
  FINISHED
}
```

**Notes:**
- `roomCode` is a 6-character alphanumeric code generated when multi-device sync is enabled. Null for local-only sessions.
- `hostId` identifies the device that created the session (used for permission checks).
- State transitions: `LOBBY -> ACTIVE -> PAUSED <-> ACTIVE -> FINISHED`. From `LOBBY`, the session can also be deleted.

### Player

A participant in a game session. Players are scoped to a session (not global profiles yet - that's v1.2).

```prisma
model Player {
  id            String       @id @default(uuid()) @db.Uuid
  sessionId     String       @db.Uuid
  name          String       @db.VarChar(50)
  color         String       @db.VarChar(7)  // hex color, e.g. "#3B82F6"
  avatar        String?      @db.VarChar(10) // emoji or initials
  sortOrder     Int          @default(0)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  session       GameSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  scoreEvents   ScoreEvent[]

  @@unique([sessionId, name])
  @@index([sessionId])
}
```

**Notes:**
- `color` stores a hex string from the predefined 12-color palette.
- `avatar` is an emoji character (e.g. "🎲") or 2-letter initials.
- `sortOrder` controls the display/seating order, updated by drag-and-drop.
- Unique constraint on `[sessionId, name]` enforces unique names per session.

### ScoreEvent

An immutable record of a score change. This is the core of the event-sourced design.

```prisma
model ScoreEvent {
  id            String      @id @default(uuid()) @db.Uuid
  sessionId     String      @db.Uuid
  playerId      String      @db.Uuid
  delta         Int         // the change: +2, -1, +10, etc.
  scoreBefore   Int         // player's score before this event
  scoreAfter    Int         // player's score after this event
  note          String?     @db.VarChar(200) // optional context, e.g. "Longest Road"
  reverted      Boolean     @default(false)
  revertedAt    DateTime?
  clientEventId String      @unique @db.VarChar(36) // client-generated UUID for idempotency
  createdAt     DateTime    @default(now())

  session       GameSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  player        Player      @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
  @@index([playerId])
  @@index([clientEventId])
}
```

**Notes:**
- `delta` is the point change (positive or negative).
- `scoreBefore` and `scoreAfter` are denormalized for fast display without replaying the full log.
- `reverted` is a soft-delete flag. Reverting an event does NOT delete it - it marks it and creates a compensating event with the opposite delta.
- `clientEventId` is generated client-side (UUID v4) to prevent duplicate events when offline mutations are replayed.

### SessionParticipant

A connected device in a multi-device session. Tracks who joined via room code and their permission level.

```prisma
model SessionParticipant {
  id          String              @id @default(uuid()) @db.Uuid
  sessionId   String              @db.Uuid
  clientId    String              @db.VarChar(64) // client-generated fingerprint (stored in localStorage)
  displayName String?             @db.VarChar(50) // optional label for this device, e.g. "Bob's phone"
  role        ParticipantRole     @default(SCORER)
  joinedAt    DateTime            @default(now())
  lastSeenAt  DateTime            @default(now())

  session     GameSession         @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, clientId])
  @@index([sessionId])
}

enum ParticipantRole {
  HOST
  SCORER
  VIEWER
}
```

**Notes:**
- `clientId` is a random UUID generated once per device and persisted in `localStorage`. It matches `GameSession.hostId` for the host device.
- `role` controls permissions: `HOST` has full control, `SCORER` can add/undo score events, `VIEWER` is read-only. For MVP, the session creator gets `HOST` and all others default to `SCORER`.
- `lastSeenAt` is updated on each WebSocket heartbeat. Participants with `lastSeenAt` older than 24 hours can be cleaned up.
- The unique constraint on `[sessionId, clientId]` prevents duplicate entries if the same device reconnects.

## Color Palette

12 accessible colors that work in both light and dark mode:

```typescript
const PLAYER_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#22C55E", // green
  "#A855F7", // purple
  "#F97316", // orange
  "#06B6D4", // cyan
  "#EC4899", // pink
  "#EAB308", // yellow
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#F43F5E", // rose
  "#84CC16", // lime
] as const;
```

## Derived Data (Not Stored)

These values are **computed client-side** from the stored data, not persisted:

| Value | Derivation |
|-------|-----------|
| Current score per player | Sum of non-reverted `ScoreEvent.delta` for that player |
| Player rankings | Sort players by current score descending |
| Winner | Player with highest score when session status is `FINISHED` |
| Game duration | `finishedAt - startedAt` (excluding paused time) |
| Score history feed | `ScoreEvent` records ordered by `createdAt DESC` |

The `scoreBefore`/`scoreAfter` fields on `ScoreEvent` provide a fast path so we don't always need to replay the full event log.

## Indexes Strategy

| Index | Purpose |
|-------|---------|
| `GameSession.roomCode` | Fast room code lookup for join flow |
| `GameSession.status` | Query active/lobby sessions |
| `GameSession.createdAt` | Sort sessions by recency |
| `ScoreEvent(sessionId, createdAt)` | Fetch score history for a session in order |
| `ScoreEvent.playerId` | Fetch events for a specific player |
| `ScoreEvent.clientEventId` | Idempotency check on offline replay |
| `Player.sessionId` | Fetch all players in a session |
| `SessionParticipant.sessionId` | Fetch all participants in a session |
| `SessionParticipant(sessionId, clientId)` | Lookup a specific device in a session |

## Migration Plan

### Migration 1: `init_core_schema`

Creates all four tables, enums, and indexes in a single migration since this is a greenfield project.

```bash
bunx prisma migrate dev --name init_core_schema
```

### Future Migrations (v1.1+)

| Migration | Purpose |
|-----------|---------|
| `add_game_templates` | GameTemplate model with scoring config |
| `add_rounds` | Round model linking to ScoreEvent |
| `add_score_categories` | ScoreCategory model for multi-dimensional scoring |
| `add_player_profiles` | Global PlayerProfile linked across sessions |

## Seed Data

A seed script (`prisma/seed.ts`) will generate sample data for development:

- 3 game sessions (one in each state: LOBBY, ACTIVE, FINISHED)
- 4 players per session
- 20-50 score events for active/finished sessions
- Uses `@faker-js/faker` (already installed)
