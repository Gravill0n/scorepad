# Real-time Sync

## Overview

Multi-device sync allows multiple phones/tablets to share a game session. One device is the **host** (full control), others are **guests** (view-only or scorer permission). All devices see score updates in real-time.

## Architecture

```
┌──────────┐     WebSocket     ┌──────────────┐     Prisma     ┌────────────┐
│ Client A │ ◄──────────────►  │ Nitro Server │ ◄────────────► │ PostgreSQL │
│ (Host)   │                   │ (WS Handler) │                │            │
└──────────┘                   └──────────────┘                └────────────┘
                                    ▲
┌──────────┐     WebSocket          │
│ Client B │ ◄──────────────────────┘
│ (Guest)  │
└──────────┘
```

## WebSocket Protocol

### Connection

Clients connect to a WebSocket endpoint scoped to a room:

```
ws://localhost:3000/_ws/rooms/:roomCode
```

Nitro supports WebSocket handlers natively via `defineWebSocketHandler`.

### Message Types

All messages are JSON with a `type` field and a `payload`. Incoming messages from clients are validated with Zod before processing (see validation schemas below).

```typescript
type WsMessage =
  | { type: "join"; payload: { roomCode: string; clientId: string } }
  | { type: "leave"; payload: { clientId: string } }
  | { type: "session_state"; payload: SessionSnapshot }
  | { type: "score_event"; payload: ScoreEventData }
  | { type: "score_event_ack"; payload: { clientEventId: string } }
  | { type: "undo_event"; payload: { eventId: string } }
  | { type: "player_added"; payload: PlayerData }
  | { type: "player_removed"; payload: { playerId: string } }
  | { type: "players_reordered"; payload: { playerIds: string[] } }
  | { type: "status_changed"; payload: { status: SessionStatus } }
  | { type: "peer_count"; payload: { count: number } }
  | { type: "error"; payload: { message: string; code: string } };
```

### Client Message Validation

Incoming WebSocket messages from clients are validated with Zod before dispatch. This reuses the same schemas defined in `src/server/validation/`.

```typescript
// src/server/ws/validation.ts
import { z } from "zod";
import { addScoreEventSchema, undoScoreEventSchema } from "#/server/validation/scores";
import { addPlayerSchema, reorderPlayersSchema } from "#/server/validation/players";
import { updateSessionStatusSchema } from "#/server/validation/sessions";

const wsClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("score_event"), payload: addScoreEventSchema }),
  z.object({ type: z.literal("undo_event"), payload: undoScoreEventSchema }),
  z.object({ type: z.literal("status_changed"), payload: updateSessionStatusSchema }),
  z.object({ type: z.literal("player_added"), payload: addPlayerSchema }),
  z.object({ type: z.literal("player_removed"), payload: z.object({ playerId: z.string().uuid() }) }),
  z.object({ type: z.literal("players_reordered"), payload: reorderPlayersSchema }),
]);

export type WsClientMessage = z.infer<typeof wsClientMessageSchema>;

export function parseClientMessage(raw: string): WsClientMessage {
  const json = JSON.parse(raw);
  return wsClientMessageSchema.parse(json);
}
```

### Flow: Score Update

```
Client A (Host)                    Server                     Client B (Guest)
     │                               │                              │
     │  score_event {delta:+2}       │                              │
     │ ─────────────────────────────►│                              │
     │                               │  Write to DB                 │
     │                               │  ──────►                     │
     │                               │  ◄──────                     │
     │  score_event_ack              │                              │
     │ ◄─────────────────────────────│                              │
     │                               │  score_event (broadcast)     │
     │                               │ ────────────────────────────►│
     │                               │                              │
```

1. Client sends `score_event` with `clientEventId`
2. Server persists to DB (idempotent via `clientEventId`)
3. Server sends `score_event_ack` to the sender
4. Server broadcasts `score_event` to all other clients in the room

### Flow: Join Room

```
Client B                          Server
     │                               │
     │  connect ws://.../:roomCode   │
     │ ─────────────────────────────►│
     │                               │  Validate room code
     │                               │  Load full session state
     │  session_state (full snapshot)│
     │ ◄─────────────────────────────│
     │                               │
     │                               │  Broadcast peer_count to all
     │  peer_count {count: 2}        │
     │ ◄─────────────────────────────│
     │                               │
```

On join, the server sends the **full session snapshot** so the client doesn't need a separate fetch.

### Flow: Reconnection

```
Client B                          Server
     │                               │
     │  (connection lost)            │
     │  ...                          │
     │  reconnect + join             │
     │ ─────────────────────────────►│
     │                               │  Load current state
     │  session_state (full snapshot)│
     │ ◄─────────────────────────────│
     │                               │
```

On reconnect, the client receives a fresh snapshot. No delta sync needed - the full state is small enough (session + players + recent events).

## Server Implementation

### WebSocket Handler

```typescript
// src/server/ws/rooms.ts
import { defineWebSocketHandler } from "nitro";
import { parseClientMessage } from "./validation";

// In-memory room registry
const rooms = new Map<string, Set<WebSocket>>();

export default defineWebSocketHandler({
  open(peer) {
    const roomCode = peer.url?.split("/").pop();
    if (!roomCode) return peer.close(4400, "Missing room code");

    // Add to room
    if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
    rooms.get(roomCode)!.add(peer);

    // Send full session state
    loadSessionSnapshot(roomCode).then((snapshot) => {
      peer.send(
        JSON.stringify({
          type: "session_state",
          payload: snapshot,
        }),
      );
    });

    // Broadcast updated peer count
    broadcastToRoom(roomCode, {
      type: "peer_count",
      payload: { count: rooms.get(roomCode)!.size },
    });
  },

  message(peer, message) {
    const roomCode = getRoomCode(peer);

    let msg;
    try {
      msg = parseClientMessage(message.text());
    } catch {
      peer.send(JSON.stringify({
        type: "error",
        payload: { message: "Invalid message format", code: "INVALID_MESSAGE" },
      }));
      return;
    }

    handleMessage(peer, roomCode, msg);
  },

  close(peer) {
    const roomCode = getRoomCode(peer);
    rooms.get(roomCode)?.delete(peer);
    if (rooms.get(roomCode)?.size === 0) {
      rooms.delete(roomCode);
    } else {
      broadcastToRoom(roomCode, {
        type: "peer_count",
        payload: { count: rooms.get(roomCode)!.size },
      });
    }
  },
});
```

### Message Handler

```typescript
async function handleMessage(
  peer: WebSocket,
  roomCode: string,
  msg: WsMessage,
) {
  switch (msg.type) {
    case "score_event": {
      const event = await addScoreEvent(msg.payload);
      // Ack to sender
      peer.send(
        JSON.stringify({
          type: "score_event_ack",
          payload: { clientEventId: msg.payload.clientEventId },
        }),
      );
      // Broadcast to others
      broadcastToRoom(roomCode, msg, peer);
      break;
    }

    case "undo_event": {
      await undoScoreEvent(msg.payload);
      broadcastToRoom(roomCode, msg); // broadcast to all including sender
      break;
    }

    case "status_changed": {
      await updateSessionStatus(msg.payload);
      broadcastToRoom(roomCode, msg);
      break;
    }

    // ... other handlers
  }
}
```

### Broadcast Helper

```typescript
function broadcastToRoom(roomCode: string, msg: object, exclude?: WebSocket) {
  const peers = rooms.get(roomCode);
  if (!peers) return;

  const data = JSON.stringify(msg);
  for (const peer of peers) {
    if (peer !== exclude && peer.readyState === WebSocket.OPEN) {
      peer.send(data);
    }
  }
}
```

## Client Implementation

### WebSocket Hook (pushes into TanStack DB collections)

WebSocket events are pushed directly into TanStack DB collections via `collection.upsert()` and `collection.update()`. All `useLiveQuery` hooks react automatically - no manual `setQueryData` calls.

```typescript
// src/hooks/useSessionSync.ts
export function useSessionSync(roomCode: string | null) {
  const { session, players, scoreEvents } = useSessionCollections();
  const wsRef = useRef<WebSocket | null>(null);
  const [peerCount, setPeerCount] = useState(0);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected"
  >("disconnected");

  useEffect(() => {
    if (!roomCode) return;

    const ws = new WebSocket(`${getWsUrl()}/_ws/rooms/${roomCode}`);
    wsRef.current = ws;

    ws.onopen = () => setConnectionState("connected");
    ws.onclose = () => {
      setConnectionState("disconnected");
      scheduleReconnect();
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "session_state":
          // Full snapshot: upsert session, players, and events into collections
          session.upsert(msg.payload.session);
          for (const p of msg.payload.players) players.upsert(p);
          for (const e of msg.payload.scoreEvents) scoreEvents.upsert(e);
          break;

        case "score_event":
          // Insert a single new score event into the collection
          scoreEvents.upsert(msg.payload);
          break;

        case "undo_event":
          // Mark the event as reverted in the collection
          scoreEvents.update(msg.payload.eventId, {
            reverted: true,
            revertedAt: msg.payload.revertedAt,
          });
          if (msg.payload.compensatingEvent) {
            scoreEvents.upsert(msg.payload.compensatingEvent);
          }
          break;

        case "player_added":
          players.upsert(msg.payload);
          break;

        case "player_removed":
          players.delete(msg.payload.playerId);
          break;

        case "status_changed":
          session.update(msg.payload.sessionId, { status: msg.payload.status });
          break;

        case "peer_count":
          setPeerCount(msg.payload.count);
          break;
      }
    };

    return () => ws.close();
  }, [roomCode, session, players, scoreEvents]);

  // Send message helper
  const send = useCallback((msg: WsMessage) => {
    wsRef.current?.send(JSON.stringify(msg));
  }, []);

  return { send, peerCount, connectionState };
}
```

### Reconnection Strategy

```typescript
function scheduleReconnect() {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
  const delay = Math.min(1000 * Math.pow(2, attemptCount), 30000);
  setTimeout(() => reconnect(), delay);
}
```

- Auto-reconnect with exponential backoff (1s to 30s)
- On reconnect, server sends full snapshot (no delta tracking needed)
- Show "Reconnecting..." banner while disconnected
- Reset backoff counter on successful connection

## Room Code Lifecycle

| Event                | Action                                                          |
| -------------------- | --------------------------------------------------------------- |
| Session created      | Room code generated (always, even for local sessions)           |
| First peer connects  | Room added to in-memory registry                                |
| All peers disconnect | Room removed from registry                                      |
| Session finished     | Room code remains valid for 24h (view results)                  |
| 24h inactivity       | Room code expires (no cleanup needed - just reject connections) |

## Permissions

| Action               | Host | Scorer Guest | View-only Guest |
| -------------------- | ---- | ------------ | --------------- |
| Add/remove players   | Yes  | No           | No              |
| Start/pause/end game | Yes  | No           | No              |
| Add score events     | Yes  | Yes          | No              |
| Undo score events    | Yes  | Yes          | No              |
| View scoreboard      | Yes  | Yes          | Yes             |
| View history         | Yes  | Yes          | Yes             |

For MVP, all guests are **scorers** by default. Permission controls come in v1.1.

## Scaling Considerations (Post-MVP)

The in-memory room registry works for a single server. For horizontal scaling:

1. **Redis pub/sub** - Replace in-memory `rooms` Map with Redis pub/sub channels
2. **Sticky sessions** - Use load balancer sticky sessions by room code
3. **Server-Sent Events fallback** - For clients that can't maintain WebSocket connections

These are NOT needed for MVP but the architecture supports them:

- Room management is abstracted behind `broadcastToRoom`
- All mutations go through the database (single source of truth)
- WebSocket is a notification channel, not a data store
