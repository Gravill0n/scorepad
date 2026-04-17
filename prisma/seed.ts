import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear tables in dependency order
  await prisma.scoreEvent.deleteMany();
  await prisma.sessionParticipant.deleteMany();
  await prisma.player.deleteMany();
  await prisma.gameSession.deleteMany();

  // ── Session 1: "Catan Night" (FINISHED) ──────────────────────────

  const catanHostClientId = faker.string.uuid();
  const catanSession = await prisma.gameSession.create({
    data: {
      name: "Catan Night",
      status: "FINISHED",
      roomCode: "CATAN1",
      hostId: catanHostClientId,
      startedAt: new Date("2026-04-16T19:00:00Z"),
      finishedAt: new Date("2026-04-16T21:30:00Z"),
    },
  });

  const catanPlayers = await Promise.all(
    [
      { name: "Alice", color: "#3B82F6", avatar: "🧙", sortOrder: 0 },
      { name: "Bob", color: "#EF4444", avatar: "🏰", sortOrder: 1 },
      { name: "Charlie", color: "#10B981", avatar: "🐉", sortOrder: 2 },
      { name: "Diana", color: "#F59E0B", avatar: "⚔️", sortOrder: 3 },
    ].map((p) =>
      prisma.player.create({
        data: { sessionId: catanSession.id, ...p },
      })
    )
  );

  const [alice, bob, charlie, diana] = catanPlayers;

  // Score events with correct before/after chains
  const catanEvents: Array<{
    playerId: string;
    delta: number;
    scoreBefore: number;
    scoreAfter: number;
    note?: string;
    reverted?: boolean;
    revertedAt?: Date;
  }> = [
    { playerId: alice.id, delta: 2, scoreBefore: 0, scoreAfter: 2, note: "Initial settlements" },
    { playerId: bob.id, delta: 2, scoreBefore: 0, scoreAfter: 2, note: "Initial settlements" },
    { playerId: charlie.id, delta: 2, scoreBefore: 0, scoreAfter: 2, note: "Initial settlements" },
    { playerId: diana.id, delta: 2, scoreBefore: 0, scoreAfter: 2, note: "Initial settlements" },
    { playerId: alice.id, delta: 1, scoreBefore: 2, scoreAfter: 3, note: "New settlement" },
    { playerId: bob.id, delta: 2, scoreBefore: 2, scoreAfter: 4, note: "Longest Road" },
    {
      playerId: bob.id,
      delta: -2,
      scoreBefore: 4,
      scoreAfter: 2,
      note: "Longest Road reverted",
      reverted: true,
      revertedAt: new Date("2026-04-16T20:15:00Z"),
    },
    { playerId: charlie.id, delta: 3, scoreBefore: 2, scoreAfter: 5, note: "City upgrade + settlement" },
    { playerId: alice.id, delta: 2, scoreBefore: 3, scoreAfter: 5, note: "Largest Army" },
    { playerId: diana.id, delta: 3, scoreBefore: 2, scoreAfter: 5, note: "Two cities" },
  ];

  for (const event of catanEvents) {
    await prisma.scoreEvent.create({
      data: {
        sessionId: catanSession.id,
        playerId: event.playerId,
        delta: event.delta,
        scoreBefore: event.scoreBefore,
        scoreAfter: event.scoreAfter,
        note: event.note,
        reverted: event.reverted ?? false,
        revertedAt: event.revertedAt,
        clientEventId: crypto.randomUUID(),
      },
    });
  }

  await Promise.all(
    [
      { clientId: catanHostClientId, displayName: "Alice's laptop", role: "HOST" as const },
      { clientId: faker.string.uuid(), displayName: "Bob's phone", role: "SCORER" as const },
      { clientId: faker.string.uuid(), displayName: "Charlie's tablet", role: "SCORER" as const },
      { clientId: faker.string.uuid(), displayName: "Diana's phone", role: "SCORER" as const },
    ].map((p) =>
      prisma.sessionParticipant.create({
        data: { sessionId: catanSession.id, ...p },
      })
    )
  );

  // ── Session 2: "Ticket to Ride" (ACTIVE) ─────────────────────────

  const ticketHostClientId = faker.string.uuid();
  const ticketSession = await prisma.gameSession.create({
    data: {
      name: "Ticket to Ride",
      status: "ACTIVE",
      roomCode: "TRAIN7",
      hostId: ticketHostClientId,
      startedAt: new Date("2026-04-17T14:00:00Z"),
    },
  });

  const ticketPlayers = await Promise.all(
    [
      { name: "Eve", color: "#8B5CF6", avatar: "🚂", sortOrder: 0 },
      { name: "Frank", color: "#EC4899", avatar: "🎫", sortOrder: 1 },
      { name: "Grace", color: "#06B6D4", avatar: "🗺️", sortOrder: 2 },
    ].map((p) =>
      prisma.player.create({
        data: { sessionId: ticketSession.id, ...p },
      })
    )
  );

  const [eve, frank, grace] = ticketPlayers;

  const ticketEvents: Array<{
    playerId: string;
    delta: number;
    scoreBefore: number;
    scoreAfter: number;
    note?: string;
  }> = [
    { playerId: eve.id, delta: 4, scoreBefore: 0, scoreAfter: 4, note: "LA to Phoenix route" },
    { playerId: frank.id, delta: 7, scoreBefore: 0, scoreAfter: 7, note: "Portland to Nashville" },
    { playerId: grace.id, delta: 2, scoreBefore: 0, scoreAfter: 2, note: "Short route" },
    { playerId: eve.id, delta: 10, scoreBefore: 4, scoreAfter: 14, note: "Coast to coast bonus" },
  ];

  for (const event of ticketEvents) {
    await prisma.scoreEvent.create({
      data: {
        sessionId: ticketSession.id,
        playerId: event.playerId,
        delta: event.delta,
        scoreBefore: event.scoreBefore,
        scoreAfter: event.scoreAfter,
        note: event.note,
        clientEventId: crypto.randomUUID(),
      },
    });
  }

  await Promise.all(
    [
      { clientId: ticketHostClientId, displayName: "Eve's laptop", role: "HOST" as const },
      { clientId: faker.string.uuid(), displayName: "Frank's phone", role: "SCORER" as const },
      { clientId: faker.string.uuid(), displayName: "Grace's iPad", role: "SCORER" as const },
    ].map((p) =>
      prisma.sessionParticipant.create({
        data: { sessionId: ticketSession.id, ...p },
      })
    )
  );

  // ── Session 3: "Waiting Room" (LOBBY) ────────────────────────────

  const lobbyHostClientId = faker.string.uuid();
  const lobbySession = await prisma.gameSession.create({
    data: {
      name: "Waiting Room",
      status: "LOBBY",
      roomCode: "WAIT42",
      hostId: lobbyHostClientId,
    },
  });

  await Promise.all(
    [
      { name: "Hank", color: "#F97316", avatar: "🎲", sortOrder: 0 },
      { name: "Ivy", color: "#14B8A6", avatar: "🃏", sortOrder: 1 },
    ].map((p) =>
      prisma.player.create({
        data: { sessionId: lobbySession.id, ...p },
      })
    )
  );

  await Promise.all(
    [
      { clientId: lobbyHostClientId, displayName: "Hank's laptop", role: "HOST" as const },
      { clientId: faker.string.uuid(), displayName: "Ivy's phone", role: "VIEWER" as const },
    ].map((p) =>
      prisma.sessionParticipant.create({
        data: { sessionId: lobbySession.id, ...p },
      })
    )
  );

  console.info(`Seeded: 3 sessions, 9 players, ${catanEvents.length + ticketEvents.length} score events`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
