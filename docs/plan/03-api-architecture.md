# API Architecture

## Approach: TanStack Start Server Functions

All data operations use TanStack Start's `createServerFn` which provides:
- Type-safe RPC (no manual type duplication)
- Automatic serialization/deserialization
- Server-side execution with client-side call syntax
- Built-in validation via Zod schemas
- Integration with TanStack Query + TanStack DB collections for caching and reactivity

## File Structure

```
src/
├── server/
│   ├── functions/
│   │   ├── sessions.ts      # Session CRUD + state transitions
│   │   ├── players.ts       # Player CRUD within sessions
│   │   └── scores.ts        # Score events + undo
│   └── validation/
│       ├── sessions.ts      # Zod schemas for session inputs
│       ├── players.ts       # Zod schemas for player inputs
│       └── scores.ts        # Zod schemas for score inputs
├── data/
│   ├── collections/
│   │   ├── sessions.ts      # Sessions query-backed collection
│   │   ├── players.ts       # Players collection factory (per session)
│   │   ├── score-events.ts  # Score events collection factory (per session)
│   │   └── session-context.tsx  # React context for session-scoped collections
│   ├── queries/
│   │   ├── keys.ts           # Query key definitions
│   │   └── sessions.ts       # Query options (used by collections)
│   └── mutations/
│       ├── sessions.ts      # Session mutations (useOptimisticMutation)
│       ├── players.ts       # Player mutations (useOptimisticMutation)
│       └── scores.ts        # Score mutations (useOptimisticMutation)
```

## Validation Schemas

All inputs are validated server-side with Zod before touching the database.

```typescript
// src/server/validation/sessions.ts
import { z } from "zod";

export const createSessionSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateSessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["ACTIVE", "PAUSED", "FINISHED"]),
});

// src/server/validation/players.ts
export const addPlayerSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(1).max(50).trim(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  avatar: z.string().max(10).optional(),
});

export const reorderPlayersSchema = z.object({
  sessionId: z.string().uuid(),
  playerIds: z.array(z.string().uuid()),
});

// src/server/validation/scores.ts
export const addScoreEventSchema = z.object({
  sessionId: z.string().uuid(),
  playerId: z.string().uuid(),
  delta: z.number().int().min(-9999).max(9999),
  note: z.string().max(200).optional(),
  clientEventId: z.string().uuid(),
});

export const undoScoreEventSchema = z.object({
  eventId: z.string().uuid(),
});
```

## Server Functions

### Session Functions

```typescript
// src/server/functions/sessions.ts

// POST: Create a new game session
export const createSession = createServerFn({ method: "POST" })
  .validator(createSessionSchema)
  .handler(async ({ data }) => {
    const roomCode = generateRoomCode(); // 6-char alphanumeric
    return prisma.gameSession.create({
      data: {
        name: data.name,
        roomCode,
        status: "LOBBY",
      },
    });
  });

// GET: Fetch a session by ID with players and computed scores
export const getSession = createServerFn({ method: "GET" })
  .validator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const session = await prisma.gameSession.findUniqueOrThrow({
      where: { id: data.sessionId },
      include: {
        players: { orderBy: { sortOrder: "asc" } },
        scoreEvents: {
          where: { reverted: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return session;
  });

// GET: Fetch session by room code (for join flow)
export const getSessionByRoomCode = createServerFn({ method: "GET" })
  .validator(z.object({ roomCode: z.string().length(6) }))
  .handler(async ({ data }) => {
    return prisma.gameSession.findUnique({
      where: { roomCode: data.roomCode.toUpperCase() },
      include: { players: { orderBy: { sortOrder: "asc" } } },
    });
  });

// POST: Transition session state
export const updateSessionStatus = createServerFn({ method: "POST" })
  .validator(updateSessionStatusSchema)
  .handler(async ({ data }) => {
    const session = await prisma.gameSession.findUniqueOrThrow({
      where: { id: data.sessionId },
    });

    // Validate state transition
    validateStateTransition(session.status, data.status);

    const timestamps = getTimestampUpdates(data.status);
    return prisma.gameSession.update({
      where: { id: data.sessionId },
      data: { status: data.status, ...timestamps },
    });
  });

// GET: List recent sessions
export const listRecentSessions = createServerFn({ method: "GET" })
  .handler(async () => {
    return prisma.gameSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        players: { select: { id: true, name: true, color: true } },
        _count: { select: { players: true } },
      },
    });
  });
```

### Player Functions

```typescript
// src/server/functions/players.ts

// POST: Add a player to a session (lobby only)
export const addPlayer = createServerFn({ method: "POST" })
  .validator(addPlayerSchema)
  .handler(async ({ data }) => {
    const session = await prisma.gameSession.findUniqueOrThrow({
      where: { id: data.sessionId },
      include: { _count: { select: { players: true } } },
    });

    if (session.status !== "LOBBY") {
      throw new Error("Can only add players in LOBBY state");
    }
    if (session._count.players >= 20) {
      throw new Error("Maximum 20 players per session");
    }

    return prisma.player.create({
      data: {
        sessionId: data.sessionId,
        name: data.name,
        color: data.color,
        avatar: data.avatar,
        sortOrder: session._count.players,
      },
    });
  });

// POST: Remove a player (lobby only)
export const removePlayer = createServerFn({ method: "POST" })
  .validator(z.object({ playerId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: data.playerId },
      include: { session: { select: { status: true } } },
    });

    if (player.session.status !== "LOBBY") {
      throw new Error("Can only remove players in LOBBY state");
    }

    return prisma.player.delete({ where: { id: data.playerId } });
  });

// POST: Reorder players (drag-and-drop)
export const reorderPlayers = createServerFn({ method: "POST" })
  .validator(reorderPlayersSchema)
  .handler(async ({ data }) => {
    const updates = data.playerIds.map((id, index) =>
      prisma.player.update({
        where: { id },
        data: { sortOrder: index },
      })
    );
    return prisma.$transaction(updates);
  });
```

### Score Functions

```typescript
// src/server/functions/scores.ts

// POST: Add a score event
export const addScoreEvent = createServerFn({ method: "POST" })
  .validator(addScoreEventSchema)
  .handler(async ({ data }) => {
    // Idempotency: check if this client event already exists
    const existing = await prisma.scoreEvent.findUnique({
      where: { clientEventId: data.clientEventId },
    });
    if (existing) return existing;

    // Calculate current score for this player
    const currentScore = await getCurrentScore(data.playerId);

    return prisma.scoreEvent.create({
      data: {
        sessionId: data.sessionId,
        playerId: data.playerId,
        delta: data.delta,
        scoreBefore: currentScore,
        scoreAfter: currentScore + data.delta,
        note: data.note,
        clientEventId: data.clientEventId,
      },
    });
  });

// POST: Undo (revert) a score event
export const undoScoreEvent = createServerFn({ method: "POST" })
  .validator(undoScoreEventSchema)
  .handler(async ({ data }) => {
    const event = await prisma.scoreEvent.findUniqueOrThrow({
      where: { id: data.eventId },
    });

    if (event.reverted) {
      throw new Error("Event already reverted");
    }

    // Mark original as reverted + create compensating event.
    // NOTE: This does NOT recalculate scoreBefore/scoreAfter on subsequent events.
    // The compensating event applies the inverse delta at the current point in time.
    // This means scoreBefore/scoreAfter on events between the reverted event and the
    // compensating event are historically inaccurate. The authoritative current score
    // is always: sum of non-reverted deltas (see Derived Data in 01-data-schema.md).
    // The scoreBefore/scoreAfter fields are a convenience for display, not a source of truth.
    const currentScore = await getCurrentScore(event.playerId);

    const [revertedEvent, compensatingEvent] = await prisma.$transaction([
      prisma.scoreEvent.update({
        where: { id: data.eventId },
        data: { reverted: true, revertedAt: new Date() },
      }),
      prisma.scoreEvent.create({
        data: {
          sessionId: event.sessionId,
          playerId: event.playerId,
          delta: -event.delta,
          scoreBefore: currentScore,
          scoreAfter: currentScore - event.delta,
          note: `Undo: ${event.note ?? "score change"}`,
          clientEventId: crypto.randomUUID(),
        },
      }),
    ]);

    return { revertedEvent, compensatingEvent };
  });

// GET: Fetch score history for a session
export const getScoreHistory = createServerFn({ method: "GET" })
  .validator(z.object({
    sessionId: z.string().uuid(),
    cursor: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }))
  .handler(async ({ data }) => {
    return prisma.scoreEvent.findMany({
      where: { sessionId: data.sessionId },
      orderBy: { createdAt: "desc" },
      take: data.limit + 1, // fetch one extra for cursor pagination
      ...(data.cursor ? { cursor: { id: data.cursor }, skip: 1 } : {}),
      include: {
        player: { select: { name: true, color: true } },
      },
    });
  });
```

## State Transition Rules

```
LOBBY → ACTIVE     (requires 2+ players)
ACTIVE → PAUSED
PAUSED → ACTIVE
ACTIVE → FINISHED
PAUSED → FINISHED
```

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  LOBBY: ["ACTIVE"],
  ACTIVE: ["PAUSED", "FINISHED"],
  PAUSED: ["ACTIVE", "FINISHED"],
  FINISHED: [],
};

function validateStateTransition(from: string, to: string): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}
```

## Helper Utilities

```typescript
// Room code generation (6 chars, alphanumeric, no ambiguous chars)
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

// Current score for a player (sum of non-reverted deltas)
async function getCurrentScore(playerId: string): Promise<number> {
  const result = await prisma.scoreEvent.aggregate({
    where: { playerId, reverted: false },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

// Timestamp updates based on status transition
function getTimestampUpdates(status: string) {
  switch (status) {
    case "ACTIVE": return { startedAt: new Date() };
    case "PAUSED": return { pausedAt: new Date() };
    case "FINISHED": return { finishedAt: new Date() };
    default: return {};
  }
}
```

## TanStack DB + Query Integration

Server functions are consumed on the client via **TanStack DB collections** backed by **TanStack Query**. Collections provide reactive, queryable data stores. Query handles fetch lifecycle (loading, error, stale-while-revalidate).

### Collections (backed by Query)

```typescript
// src/data/collections/score-events.ts
import { createQueryCollection } from "@tanstack/query-db-collection";

export function createScoreEventsCollection(sessionId: string) {
  return createQueryCollection<ScoreEvent>({
    queryClient,
    queryKey: ["scores", sessionId],
    queryFn: () => getScoreEvents({ data: { sessionId } }),
    getKey: (event) => event.id,
  });
}
```

### Mutations with Automatic Optimistic Rollback

```typescript
// src/data/mutations/scores.ts
import { useOptimisticMutation } from "@tanstack/react-db";

export function useAddScoreEvent() {
  const { scoreEvents } = useSessionCollections();

  return useOptimisticMutation(scoreEvents, {
    mutationFn: async (event: ScoreEvent) => {
      return addScoreEvent({ data: event });
    },
  });
}

// No onMutate/onError/onSettled needed.
// TanStack DB inserts into the collection immediately,
// all live queries re-evaluate, and rolls back on error.
```

### Live Queries (replace manual useMemo)

```typescript
// In components: reactive, auto-updating derived data
const rankings = useLiveQuery((q) =>
  q.from(scoreEvents)
    .where((e) => !e.reverted)
    // ... compute scores and sort
);
```

See [06-state-management.md](./06-state-management.md) for full collection definitions, live query examples, and the session-scoped context pattern.

## Error Handling Strategy

| Error Type | HTTP-like Code | Client Handling |
|-----------|---------------|-----------------|
| Validation error (bad input) | 400 | Show inline form error |
| Not found (bad session/player ID) | 404 | Redirect to home with toast |
| Invalid state transition | 409 | Show toast with explanation |
| Duplicate player name | 409 | Show inline error on name input |
| Server error | 500 | Show generic error toast + retry button |
| Network error (offline) | - | Queue mutation, show offline indicator |

All server functions throw typed errors that the client can catch and display appropriately.
