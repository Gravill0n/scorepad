# Offline Support

## Overview

The app must work without an internet connection for single-device use. When connectivity returns, queued mutations sync to the server. This is implemented as a Progressive Web App (PWA) with IndexedDB for local persistence.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                        Browser                       │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │  React   │  │  TanStack DB │  │   Service     │   │
│  │  App     │──│  Collections │  │   Worker      │   │
│  │          │  │  (in-memory) │  │  (Workbox)    │   │
│  └──────────┘  └──────┬───────┘  └───────┬───────┘   │
│                       │                  │           │
│            ┌──────────┴──────────┐       │           │
│            │   TanStack Query    │       │           │
│            │   (fetch lifecycle) │       │           │
│            └──────────┬──────────┘       │           │
│                       │                  │           │
│            ┌──────────┴──────────┐       │           │
│            │   Persistence       │       │           │
│            │   Adapter           │       │           │
│            └──────────┬──────────┘       │           │
│                       │                  │           │
│  ┌────────────────────┴────────────┐     │           │
│  │          IndexedDB              │     │           │
│  │  ┌──────────┐ ┌──────────────┐  │     │           │
│  │  │Collection│ │  Sync Queue  │  │     │           │
│  │  │Snapshots │ │  (pending    │  │     │           │
│  │  │          │ │   mutations) │  │     │           │
│  │  └──────────┘ └──────────────┘  │     │           │
│  └─────────────────────────────────┘     │           │
│                                          │           │
└──────────────────────────────────────────┼───────────┘
                                           │
                                  ┌────────┴────────┐
                                  │  Static Assets  │
                                  │  (cached)       │
                                  └─────────────────┘
```

TanStack DB collections are the in-memory data layer. A **persistence adapter** subscribes to collection mutations and snapshots them to IndexedDB. On app boot, collections are seeded from IndexedDB (`initialData`) before Query fetches fresh data from the server.

## PWA Setup

### Web App Manifest

```json
// public/manifest.json
{
  "name": "Board Game Counter",
  "short_name": "BGCounter",
  "description": "Track scores for any board game, anywhere.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#3B82F6",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### Vite PWA Plugin

Use `vite-plugin-pwa` with Workbox for service worker generation:

```typescript
// Addition to vite.config.ts
import { VitePWA } from "vite-plugin-pwa";

VitePWA({
  registerType: "autoUpdate",
  workbox: {
    // Cache app shell and static assets
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
    // Runtime caching for API calls
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/api\/.*/,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-cache",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
        },
      },
    ],
  },
  manifest: {
    // ... manifest properties above
  },
});
```

### Service Worker Strategy

| Resource Type                | Caching Strategy                  | Rationale                               |
| ---------------------------- | --------------------------------- | --------------------------------------- |
| App shell (HTML)             | Cache First, update in background | Instant load, auto-update               |
| JS/CSS bundles               | Cache First (hashed filenames)    | Immutable, versioned by hash            |
| Static assets (icons, fonts) | Cache First                       | Rarely change                           |
| API calls (server functions) | Network First, 3s timeout         | Fresh data preferred, fallback to cache |
| WebSocket                    | No caching                        | Real-time only                          |

## IndexedDB Storage

IndexedDB serves two purposes:

1. **Collection persistence** - Snapshot TanStack DB collection contents so the app can boot offline
2. **Sync queue** - Store pending mutations that haven't been sent to the server yet

Use **Dexie.js** for the sync queue (needs indexed queries). For collection snapshots, use TanStack DB's persistence callbacks with `idb-keyval` (simpler key-value storage).

### Collection Persistence Adapter

TanStack DB collections support `onInsert`, `onUpdate`, and `onDelete` callbacks. We use these to persist collection state to IndexedDB:

```typescript
// src/lib/collection-persistence.ts
import { get, set, del } from "idb-keyval";

/** Persist a collection's contents to IndexedDB as a key-value snapshot */
export function withPersistence<T>(
  collectionId: string,
  getKey: (record: T) => string,
) {
  const storageKey = `collection:${collectionId}`;

  return {
    // Load initial data from IndexedDB on boot
    initialData: async (): Promise<T[]> => {
      const snapshot = await get<Record<string, T>>(storageKey);
      return snapshot ? Object.values(snapshot) : [];
    },

    // Persist on every mutation
    onInsert: async (records: T[]) => {
      const snapshot = (await get<Record<string, T>>(storageKey)) ?? {};
      for (const record of records) {
        snapshot[getKey(record)] = record;
      }
      await set(storageKey, snapshot);
    },

    onUpdate: async (records: T[]) => {
      const snapshot = (await get<Record<string, T>>(storageKey)) ?? {};
      for (const record of records) {
        snapshot[getKey(record)] = record;
      }
      await set(storageKey, snapshot);
    },

    onDelete: async (keys: string[]) => {
      const snapshot = (await get<Record<string, T>>(storageKey)) ?? {};
      for (const key of keys) {
        delete snapshot[key];
      }
      await set(storageKey, snapshot);
    },
  };
}
```

### Using the Persistence Adapter with Collections

```typescript
// src/data/collections/score-events.ts
import { createQueryCollection } from "@tanstack/query-db-collection";
import { withPersistence } from "#/lib/collection-persistence";

export function createScoreEventsCollection(sessionId: string) {
  const persistence = withPersistence<ScoreEvent>(
    `scores:${sessionId}`,
    (event) => event.id,
  );

  return createQueryCollection<ScoreEvent>({
    queryClient,
    queryKey: ["scores", sessionId],
    queryFn: () => getScoreEvents({ data: { sessionId } }),
    getKey: (event) => event.id,
    initialData: persistence.initialData,
    onInsert: persistence.onInsert,
    onUpdate: persistence.onUpdate,
    onDelete: persistence.onDelete,
  });
}
```

### Sync Queue (Dexie)

The sync queue stores mutations that failed to send (offline). It needs indexed queries for ordered processing and retry tracking.

```typescript
// src/lib/offline-db.ts
import Dexie, { type EntityTable } from "dexie";

interface SyncQueueItem {
  id?: number; // auto-increment
  type:
    | "score_event"
    | "undo_event"
    | "status_change"
    | "add_player"
    | "remove_player";
  payload: Record<string, unknown>;
  createdAt: Date;
  retryCount: number;
}

// Dexie only manages the sync queue.
// Collection data is persisted via idb-keyval through the persistence adapter.
const db = new Dexie("boardgame-counter-sync") as Dexie & {
  syncQueue: EntityTable<SyncQueueItem, "id">;
};

db.version(1).stores({
  syncQueue: "++id, type, createdAt",
});

export { db };
```

## Sync Queue

When offline, `useOptimisticMutation` still applies changes to the TanStack DB collection (instant UI update), but the `mutationFn` fails with a network error. We intercept this to queue the mutation for later.

### Queue Entry Structure

```typescript
interface SyncQueueItem {
  id: number; // auto-increment
  type: string; // mutation type
  payload: object; // the mutation data (includes clientEventId for idempotency)
  createdAt: Date; // when the mutation was created
  retryCount: number; // number of failed sync attempts
}
```

### Queuing a Mutation

The `mutationFn` in `useOptimisticMutation` detects offline state and queues instead of failing:

```typescript
// src/lib/sync-manager.ts

async function withOfflineQueue<T>(
  type: string,
  payload: object,
  serverFn: () => Promise<T>,
): Promise<T> {
  if (navigator.onLine) {
    return serverFn();
  }

  // Queue for later and return a placeholder
  // The optimistic update in the collection already applied the change
  await db.syncQueue.add({
    type,
    payload,
    createdAt: new Date(),
    retryCount: 0,
  });

  // Return the payload as-is (the collection already has it)
  return payload as T;
}

// Usage in mutation:
export function useAddScoreEvent() {
  const { scoreEvents } = useSessionCollections();

  return useOptimisticMutation(scoreEvents, {
    mutationFn: async (event: ScoreEvent) =>
      withOfflineQueue("score_event", event, () =>
        addScoreEvent({ data: event }),
      ),
  });
}
```

### Processing the Queue (on reconnect)

```typescript
async function processSyncQueue() {
  const items = await db.syncQueue.orderBy("createdAt").toArray();

  for (const item of items) {
    try {
      await sendToServer(item.type, item.payload);
      await db.syncQueue.delete(item.id!);
    } catch (error) {
      if (isRetryable(error)) {
        await db.syncQueue.update(item.id!, {
          retryCount: item.retryCount + 1,
        });
        if (item.retryCount >= 5) {
          // Move to dead letter / notify user
          console.error("Sync item failed permanently:", item);
          await db.syncQueue.delete(item.id!);
        }
        break; // Stop processing, retry later
      } else {
        // Non-retryable error (e.g., 400 validation) - discard
        await db.syncQueue.delete(item.id!);
      }
    }
  }
}
```

### Sync Trigger Points

| Trigger                            | Action                                                |
| ---------------------------------- | ----------------------------------------------------- |
| Browser comes online               | `window.addEventListener("online", processSyncQueue)` |
| WebSocket reconnects               | Process queue before accepting new events             |
| App foreground (visibility change) | Check connectivity and process queue                  |
| Manual retry                       | User taps "Sync now" button                           |

## Online/Offline Detection

```typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
```

### UI Indicator

```
┌──────────────────────────────┐
│  ⚡ Offline - changes saved   │  ← Banner at top when offline
│     locally                  │
└──────────────────────────────┘
```

- **Online:** No indicator (clean UI)
- **Offline:** Yellow banner: "Offline - changes saved locally"
- **Syncing:** Blue banner: "Syncing..." with progress
- **Sync error:** Red banner: "Sync failed - tap to retry"

## Conflict Resolution

### Strategy: Server Wins + Idempotent Events

Since score events are **append-only** with unique `clientEventId`:

1. Client generates a UUID for each score event
2. Server checks `clientEventId` uniqueness before inserting
3. If the event already exists (offline replay), server returns the existing record
4. No conflicts possible for additive events

### Edge Case: Session State Conflicts

If two offline clients both pause/unpause the game:

1. Server processes mutations in arrival order
2. Invalid state transitions are rejected (e.g., PAUSED -> PAUSED)
3. Client receives the rejection and fetches fresh state
4. The UI updates to reflect the server's current state

### Edge Case: Player Removed While Offline Events Pending

1. Offline client queues score events for player X
2. Another client removes player X while the first is offline
3. On sync, the server rejects events for the deleted player (foreign key constraint)
4. These events are discarded from the sync queue
5. Client fetches fresh state and updates UI

## Data Flow: Offline Session

```
1. User opens app (offline)
   ├── Service worker serves cached app shell
   ├── Collections load initialData from IndexedDB (idb-keyval)
   └── useLiveQuery renders immediately from persisted data

2. User creates a local session
   ├── useOptimisticMutation inserts into collection (instant)
   ├── Persistence adapter snapshots collection to IndexedDB
   ├── mutationFn detects offline → queues to sync queue
   └── UI works fully from in-memory collection

3. User adds score events
   ├── Event inserted into scoreEvents collection (instant)
   ├── All live queries re-evaluate (scoreboard updates)
   ├── Persistence adapter writes to IndexedDB
   └── Event queued in sync queue (Dexie)

4. Connectivity returns
   ├── Sync queue processed in order (idempotent via clientEventId)
   ├── Server creates session + players + events
   ├── TanStack Query refetches → collections sync with server state
   └── WebSocket connects for real-time sync
```

## Storage Limits

| Browser | IndexedDB Quota              |
| ------- | ---------------------------- |
| Chrome  | Up to 80% of disk space      |
| Firefox | Up to 50% of disk space      |
| Safari  | 1 GB (prompts user for more) |

A typical game session with 4 players and 100 score events is ~50KB. Storage limits are not a practical concern.

### Cleanup Policy

- Finished sessions older than 90 days: prompt user to archive or delete
- Sync queue items with 5+ failed retries: discard with notification
- IndexedDB data that conflicts with server: server wins

## Install Prompt

```typescript
// src/hooks/useInstallPrompt.ts
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return { canInstall: !!deferredPrompt, install };
}
```

Show an install banner on the home screen after the user has created 2+ sessions.
