# State Management

## Principles

1. **TanStack DB collections as the client data layer** - All server data lives in typed, reactive collections (`@tanstack/react-db`)
2. **TanStack Query as the sync engine** - Collections are backed by Query via `@tanstack/query-db-collection`, which handles fetch lifecycle (loading, error, stale-while-revalidate)
3. **Live queries for derived state** - `useLiveQuery` replaces `useMemo` computations; reactive filters, sorts, and joins re-evaluate automatically when collection data changes
4. **Optimistic mutations with automatic rollback** - `useOptimisticMutation` applies changes instantly and rolls back on server rejection, no manual `onMutate`/`onError` boilerplate
5. **Minimal client state** - Use React state only for ephemeral UI concerns (modals, form inputs, tabs)

## Why TanStack DB

TanStack Query gives a cache keyed by query keys, but cross-query consistency, optimistic updates, and reactive derived data require manual coordination (`setQueryData`, `cancelQueries`, snapshot/rollback). TanStack DB solves this by providing:

- **Typed, queryable collections** - in-memory stores indexed for fast lookup
- **Live queries** - reactive, memoized views that re-run only when relevant data changes
- **Automatic optimistic rollback** - mutations apply immediately, revert on error
- **Single ingestion point** - WebSocket, SSR, and query refetches all write to the same collection

## State Categories

| Category      | Tool                                          | Examples                                   |
| ------------- | --------------------------------------------- | ------------------------------------------ |
| Server state  | TanStack DB collections (backed by Query)     | Sessions, players, score events            |
| Derived state | `useLiveQuery`                                | Current scores, rankings, filtered history |
| UI state      | React `useState`                              | Active tab, modal open/closed, form inputs |
| Sync state    | Custom hook (`useSessionSync`)                | Connection status, peer count              |
| Offline state | Collection persistence adapters + custom hook | Sync queue size, online/offline            |

## Collections

### Definition

```typescript
// src/data/collections/sessions.ts
import { createQueryCollection } from "@tanstack/query-db-collection";

export const sessionsCollection = createQueryCollection<GameSession>({
  queryClient,
  queryKey: ["sessions"],
  queryFn: () => listRecentSessions(),
  getKey: (session) => session.id,
  gcTime: 5 * 60_000,
});
```

```typescript
// src/data/collections/players.ts
import { createQueryCollection } from "@tanstack/query-db-collection";

// One collection per active session (created dynamically)
export function createPlayersCollection(sessionId: string) {
  return createQueryCollection<Player>({
    queryClient,
    queryKey: ["players", sessionId],
    queryFn: () => getPlayersBySession({ data: { sessionId } }),
    getKey: (player) => player.id,
  });
}
```

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

### Session-scoped Collections

Since players and score events are scoped to a session, we create collections dynamically per session and provide them via React context:

```typescript
// src/data/collections/session-context.tsx
interface SessionCollections {
  session: QueryCollection<GameSession>;
  players: QueryCollection<Player>;
  scoreEvents: QueryCollection<ScoreEvent>;
}

const SessionCollectionsContext = createContext<SessionCollections | null>(null);

export function SessionCollectionsProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: ReactNode;
}) {
  const collections = useMemo(
    () => ({
      session: createSessionCollection(sessionId),
      players: createPlayersCollection(sessionId),
      scoreEvents: createScoreEventsCollection(sessionId),
    }),
    [sessionId]
  );

  return (
    <SessionCollectionsContext.Provider value={collections}>
      {children}
    </SessionCollectionsContext.Provider>
  );
}

export function useSessionCollections() {
  const ctx = useContext(SessionCollectionsContext);
  if (!ctx) throw new Error("useSessionCollections must be used within SessionCollectionsProvider");
  return ctx;
}
```

## File Structure

```
src/
├── data/
│   ├── collections/
│   │   ├── sessions.ts           # Sessions collection
│   │   ├── players.ts            # Players collection factory
│   │   ├── score-events.ts       # Score events collection factory
│   │   └── session-context.tsx   # React context for session-scoped collections
│   ├── queries/
│   │   ├── keys.ts               # Query key definitions
│   │   └── sessions.ts           # Query options (used by collections)
│   └── mutations/
│       ├── sessions.ts           # Session mutations (useOptimisticMutation)
│       ├── players.ts            # Player mutations
│       └── scores.ts             # Score mutations
```

## Live Queries

### Scoreboard (ranked players with scores)

```typescript
// In Scoreboard component
function Scoreboard() {
  const { players, scoreEvents } = useSessionCollections();

  // Live query: compute current scores and rank players
  const rankings = useLiveQuery((q) => {
    const allPlayers = q.from(players);
    const allEvents = q.from(scoreEvents).where((e) => !e.reverted);

    // Compute scores per player
    const scores = new Map<string, number>();
    for (const event of allEvents) {
      scores.set(event.playerId, (scores.get(event.playerId) ?? 0) + event.delta);
    }

    // Return players with scores, sorted by rank
    return allPlayers
      .map((p) => ({ ...p, score: scores.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ ...p, rank: i + 1 }));
  });

  return rankings.map((player) => (
    <ScoreCard key={player.id} player={player} />
  ));
}
```

**Key benefit:** This live query re-evaluates automatically when a new score event is inserted or a player is added. No `useMemo` dependency tracking needed.

### Score History (filtered, ordered)

```typescript
function ScoreHistory() {
  const { scoreEvents, players } = useSessionCollections();

  const history = useLiveQuery((q) => {
    const events = q.from(scoreEvents).orderBy("createdAt", "desc");
    const playerMap = new Map(q.from(players).map((p) => [p.id, p]));

    return events.map((event) => ({
      ...event,
      player: playerMap.get(event.playerId),
    }));
  });

  return history.map((event) => (
    <ScoreEventItem key={event.id} event={event} />
  ));
}
```

### Last Event (for undo button)

```typescript
function UndoButton() {
  const { scoreEvents } = useSessionCollections();

  const lastEvent = useLiveQuery((q) =>
    q
      .from(scoreEvents)
      .where((e) => !e.reverted)
      .orderBy("createdAt", "desc")
      .limit(1)
  );

  const undoMutation = useUndoScoreEvent();

  if (lastEvent.length === 0) return null;

  return (
    <button onClick={() => undoMutation.mutate({ eventId: lastEvent[0].id })}>
      Undo Last
    </button>
  );
}
```

## Optimistic Mutations

### Adding a Score Event

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
```

**Usage in component:**

```typescript
function ScoreCard({ player }: { player: PlayerWithScore }) {
  const addScore = useAddScoreEvent();

  const handleIncrement = (delta: number) => {
    addScore.mutate({
      id: crypto.randomUUID(),
      sessionId: player.sessionId,
      playerId: player.id,
      delta,
      scoreBefore: player.score,
      scoreAfter: player.score + delta,
      note: null,
      reverted: false,
      clientEventId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <span>{player.name}: {player.score}</span>
      <button onClick={() => handleIncrement(-1)}>-1</button>
      <button onClick={() => handleIncrement(1)}>+1</button>
      <button onClick={() => handleIncrement(5)}>+5</button>
    </div>
  );
}
```

**Flow:**

```
1. User taps [+1] on Alice
   │
2. useOptimisticMutation.mutate(newScoreEvent)
   │
3. TanStack DB:
   ├── Inserts event into scoreEvents collection (instant)
   ├── All live queries re-evaluate (scoreboard re-ranks, history updates)
   └── Calls mutationFn (server function) in background
   │
4. Server response:
   ├── SUCCESS → collection stays as-is (optimistic was correct)
   └── ERROR → TanStack DB rolls back the insert automatically
```

No manual `onMutate`, `onError`, `onSettled`, or `setQueryData` needed.

### Undoing a Score Event

```typescript
export function useUndoScoreEvent() {
  const { scoreEvents } = useSessionCollections();

  return useOptimisticMutation(scoreEvents, {
    mutationFn: async (event: ScoreEvent) => {
      return undoScoreEvent({ data: { eventId: event.id } });
    },
    // Optimistically mark as reverted
    onMutate: (event) => {
      scoreEvents.update(event.id, {
        reverted: true,
        revertedAt: new Date().toISOString(),
      });
    },
  });
}
```

### Adding a Player

```typescript
export function useAddPlayer() {
  const { players } = useSessionCollections();

  return useOptimisticMutation(players, {
    mutationFn: async (player: Player) => {
      return addPlayer({ data: player });
    },
  });
}
```

## Data Flow Per Screen

### Home Screen

```
┌──────────────┐  useLiveQuery  ┌──────────────┐  Query sync   ┌──────────┐
│  HomePage    │ ◄────────────► │  sessions    │ ◄───────────► │  Server  │
│              │   reactive     │  collection  │   fetch/cache │          │
│  sessions[]  │                │              │               │  Prisma  │
└──────────────┘                └──────────────┘               └──────────┘
```

```typescript
function HomePage() {
  const sessions = useLiveQuery((q) =>
    q.from(sessionsCollection).orderBy("updatedAt", "desc").limit(10)
  );

  return <RecentSessionsList sessions={sessions} />;
}

// Route loader for SSR - seeds the Query cache, which feeds the collection
export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["sessions"],
      queryFn: listRecentSessions,
    }),
});
```

### Game Screen (Play)

```
                                ┌──────────────────────┐
                                │   TanStack DB        │
                                │   Collections        │
                ┌──────────────►│                      │◄────────────────┐
                │  .upsert()    │  players collection  │  Query refetch  │
                │               │  scoreEvents coll.   │                 │
       ┌────────┴────────┐      └────────┬─────────────┘      ┌──────────┴──────┐
       │  WebSocket      │               │ useLiveQuery       │  Optimistic     │
       │  (incoming      │               ▼                    │  Mutation       │
       │   events)       │      ┌─────────────────┐           │  (auto-rollback)│
       │                 │      │   PlayPage      │           │                 │
       └─────────────────┘      │                 │           └─────────────────┘
                                │  rankings[]     │───────┐
                                │  history[]      │       │ useOptimisticMutation
                                │  lastEvent      │       │
                                └─────────────────┘       │
                                                          ▼
                                                  ┌──────────────┐
                                                  │  Server Fn   │
                                                  │  addScore()  │
                                                  └──────────────┘
```

The game screen has three data sources that all write to the same collections:

1. **Initial load** - SSR seeds Query cache, which feeds collections
2. **Optimistic mutations** - `useOptimisticMutation` inserts/updates directly in collections
3. **WebSocket** - `collection.upsert()` pushes real-time events from other devices

All live queries react automatically. No manual cache invalidation.

## TanStack Query Configuration

TanStack Query still handles the network lifecycle. Collections are _backed by_ Query, not a replacement for it.

```typescript
// src/integrations/tanstack-query/root-provider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s - data is fresh for this long
      gcTime: 5 * 60_000, // 5min - cache kept after unmount
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});
```

### Query Keys

```typescript
// src/data/queries/keys.ts
export const queryKeys = {
  sessions: {
    all: ["sessions"] as const,
    detail: (id: string) => ["sessions", id] as const,
    byRoomCode: (code: string) => ["sessions", "room", code] as const,
  },
  players: {
    bySession: (sessionId: string) => ["players", sessionId] as const,
  },
  scores: {
    bySession: (sessionId: string) => ["scores", sessionId] as const,
  },
};
```

## Type Definitions

```typescript
// src/data/types.ts
interface GameSession {
  id: string;
  name: string;
  status: "LOBBY" | "ACTIVE" | "PAUSED" | "FINISHED";
  roomCode: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface Player {
  id: string;
  sessionId: string;
  name: string;
  color: string;
  avatar: string | null;
  sortOrder: number;
}

interface ScoreEvent {
  id: string;
  sessionId: string;
  playerId: string;
  delta: number;
  scoreBefore: number;
  scoreAfter: number;
  note: string | null;
  reverted: boolean;
  revertedAt: string | null;
  clientEventId: string;
  createdAt: string;
}

// Derived types (produced by live queries)
interface PlayerWithScore extends Player {
  score: number;
  rank: number;
}

interface ScoreEventWithPlayer extends ScoreEvent {
  player: Player | undefined;
}
```

## UI State (React useState)

Ephemeral state that doesn't need persistence:

```typescript
// PlayPage
const [activeTab, setActiveTab] = useState<"scoreboard" | "history">(
  "scoreboard",
);

// LobbyPage
const [newPlayerName, setNewPlayerName] = useState("");

// ScoreCard
const [showCustomInput, setShowCustomInput] = useState(false);

// Global
const [toastMessage, setToastMessage] = useState<string | null>(null);
```

## Hook Summary

| Hook                                      | Purpose                                       | State Source  |
| ----------------------------------------- | --------------------------------------------- | ------------- |
| `useLiveQuery(fn)`                        | Reactive derived data from collections        | TanStack DB   |
| `useOptimisticMutation(collection, opts)` | Mutations with automatic rollback             | TanStack DB   |
| `useSessionCollections()`                 | Access session-scoped collections via context | React Context |
| `useSessionSync(roomCode)`                | WebSocket connection, pushes to collections   | Custom hook   |
| `useOnlineStatus()`                       | Online/offline detection                      | Browser API   |
| `useInstallPrompt()`                      | PWA install banner                            | Browser API   |

## Data Loading Strategy

### SSR (Server-Side Rendering)

TanStack Start loads data on the server. The Query cache is dehydrated to the client, and collections are immediately populated:

```typescript
export const Route = createFileRoute("/sessions/$sessionId/play")({
  loader: async ({ params, context }) => {
    // These seed the Query cache, which feeds the collections
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.sessions.detail(params.sessionId),
        queryFn: () => getSession({ data: { sessionId: params.sessionId } }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.players.bySession(params.sessionId),
        queryFn: () =>
          getPlayersBySession({ data: { sessionId: params.sessionId } }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.scores.bySession(params.sessionId),
        queryFn: () =>
          getScoreEvents({ data: { sessionId: params.sessionId } }),
      }),
    ]);
  },
});
```

### Client-Side Navigation

TanStack Router's `preload: "intent"` prefetches data on hover. Collections are populated before the page renders.

### WebSocket Updates

Once on the game screen, the WebSocket pushes directly into collections via `collection.upsert()`. All live queries react instantly. See [04-real-time-sync.md](./04-real-time-sync.md).

## Error Boundaries

```typescript
export const Route = createFileRoute("/sessions/$sessionId/play")({
  errorComponent: ({ error }) => (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <Link to="/">Back to Home</Link>
    </div>
  ),
});
```

## TanStack DB vs. Direct Query Cache

| Concern                 | Direct TanStack Query                   | TanStack DB Collections                         |
| ----------------------- | --------------------------------------- | ----------------------------------------------- |
| Optimistic updates      | Manual `onMutate`/`onError`/`onSettled` | Automatic via `useOptimisticMutation`           |
| Derived data            | `useMemo` with dependency arrays        | `useLiveQuery` - reactive, no deps              |
| Cross-query consistency | Manual `setQueryData` on multiple keys  | Single collection, all queries update           |
| WebSocket integration   | `queryClient.setQueryData()`            | `collection.upsert()`                           |
| Re-render granularity   | Entire query result                     | Only components whose live query result changed |
