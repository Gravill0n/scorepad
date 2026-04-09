# Board Game Counter - Technical Plan Overview

## Goal

Build an MVP board game score tracker as a full-stack PWA. Players can create game sessions, add players, track scores in real-time across multiple devices, and use the app offline.

## Tech Stack (Already Configured)

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start (React 19 + Nitro SSR) |
| Routing | TanStack Router (virtual file routes) |
| Client Data Layer | TanStack DB (`@tanstack/react-db` + `@tanstack/query-db-collection`) |
| Data Fetching | TanStack React Query (sync engine for collections) |
| Database | PostgreSQL + Prisma 7 |
| Styling | Tailwind CSS 4 + HeroUI |
| i18n | Paraglide (en, de) |
| Testing | Vitest + Testing Library |
| Linting | Biome |
| Package Manager | Bun |

## Core Features (MVP Scope)

| # | Feature | Priority | Complexity | Dependencies |
|---|---------|----------|------------|--------------|
| 1 | Game Session Management | P0 | Medium | Data schema |
| 2 | Player Management | P0 | Low | Sessions |
| 3 | Score Tracking | P0 | Medium | Players |
| 4 | Score History / Undo | P0 | Medium | Score tracking |
| 5 | Multi-device Sync | P0 | High | All above |
| 6 | Offline Support | P0 | High | All above |

## Implementation Phases

### Phase 1: Foundation (Features 1-4)

Build the core scoring experience as a single-device app.

1. **Data schema** - Define Prisma models for sessions, players, and score events
2. **Server functions** - CRUD operations via TanStack Start server functions
3. **Session flow** - Create/start/pause/end game sessions
4. **Player management** - Add/remove/reorder players with colors
5. **Score tracking** - Increment/decrement with live scoreboard
6. **Score history** - Event log with undo capability

**Deliverable:** A fully functional single-device score tracker.

### Phase 2: Real-time Sync (Feature 5)

Add multi-device support via WebSocket.

1. **WebSocket server** - Nitro WebSocket handler for real-time events
2. **Room management** - Room codes, join/leave, host permissions
3. **State synchronization** - Broadcast score changes to all connected clients
4. **Conflict resolution** - Server-authoritative timestamps, last-write-wins
5. **Reconnection** - Auto-reconnect with state catch-up

**Deliverable:** Multiple devices can share and update a game session in real-time.

### Phase 3: Offline Support (Feature 6)

Make the app work without connectivity.

1. **Service worker** - Cache static assets and app shell
2. **IndexedDB storage** - Local persistence of game state via `idb-keyval` or Dexie
3. **Sync queue** - Queue mutations while offline, replay on reconnect
4. **PWA manifest** - Install prompt, icons, splash screen
5. **Online/offline indicator** - Visual feedback for connectivity state

**Deliverable:** The app is fully usable offline and syncs when back online.

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WebSocket scaling | High | Medium | Use polling fallback; design for horizontal scaling with Redis pub/sub later |
| Offline conflict resolution | High | Medium | Server-authoritative model; append-only score events make merging simpler |
| IndexedDB browser limits | Medium | Low | Keep data compact; warn user on storage quota |
| Prisma + WebSocket integration | Medium | Medium | Keep WebSocket handler thin; reuse Prisma queries |
| PWA caching complexity | Medium | Medium | Use Workbox for service worker generation; cache-first for assets, network-first for API |

## Architecture Decisions

### 1. Event-sourced score tracking

Score changes are stored as **immutable events** (append-only log), not as mutable totals. Current scores are derived by replaying events. This enables:
- Full history and audit trail
- Undo any change by marking the event as reverted
- Conflict-free merging across devices (events are additive)
- Round-by-round breakdown (future feature)

### 2. Server-authoritative sync

The PostgreSQL database is the source of truth. Clients push events to the server, which assigns authoritative timestamps and broadcasts to all peers. This avoids complex CRDT logic while keeping sync simple.

### 3. TanStack DB as the client data layer

TanStack DB collections (`@tanstack/react-db`) provide reactive, in-memory data stores backed by TanStack Query. This replaces manual `setQueryData`/`onMutate`/`onError` patterns with:
- **Live queries** (`useLiveQuery`) for reactive derived data (scores, rankings)
- **Optimistic mutations** (`useOptimisticMutation`) with automatic rollback
- **Single ingestion point** for WebSocket, SSR, and query refetches
- **Persistence adapters** for snapshotting collections to IndexedDB (offline support)

### 4. Offline-first with sync queue

When offline, optimistic mutations still apply to TanStack DB collections (instant UI update). Failed server calls are queued in IndexedDB (via Dexie) and replayed idempotently when connectivity returns.

### 5. TanStack Server Functions for API

Use TanStack Start's `createServerFn` for all data operations instead of building a separate REST API. This gives us type-safe RPC with automatic serialization.

## Document Index

| Document | Description |
|----------|-------------|
| [01-data-schema.md](./01-data-schema.md) | Prisma models, relationships, indexes, and migration plan |
| [02-user-interface.md](./02-user-interface.md) | Screens, navigation flow, component hierarchy, and wireframes |
| [03-api-architecture.md](./03-api-architecture.md) | Server functions, data flow, validation, and error handling |
| [04-real-time-sync.md](./04-real-time-sync.md) | WebSocket protocol, room management, and conflict resolution |
| [05-offline-support.md](./05-offline-support.md) | PWA setup, service worker, IndexedDB, and sync queue |
| [06-state-management.md](./06-state-management.md) | TanStack DB collections, live queries, optimistic mutations |
