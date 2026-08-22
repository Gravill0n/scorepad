import { readFileSync } from "node:fs";
import { renderHook, waitFor } from "@testing-library/react";
import { closeDatabase, getAllSessions, getSession } from "@/lib/db";
import { templates } from "@/lib/templates/registry";
import type { Session } from "@/types/session";
import type { Template } from "@/types/template";
import {
	createSession,
	defaultSessionName,
	duplicateSession,
	getSessions,
	loadSessions,
	nextCopyName,
	removeSession,
	type SessionPatch,
	setCell,
	updateSession,
	useSessions,
} from "./sessions";

const belote = templates.find((t) => t.id === "belote") as Template;
const wingspan = templates.find((t) => t.id === "wingspan") as Template;

const wipeDatabase = () =>
	new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => resolve();
	});

const twoTeams = [
	{ name: "Nous", colorIndex: 1 },
	{ name: "Eux", colorIndex: 2 },
];

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

describe("createSession", () => {
	it("snapshots every scoring field from the template", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});

		expect(session.templateId).toBe("belote");
		expect(session.mode).toBe(belote.mode);
		expect(session.categories).toEqual(belote.categories);
		expect(session.win).toBe(belote.win);
		expect(session.targetScore).toBe(belote.targetScore);
		expect(session.entry).toBe("team");
	});

	it("copies the categories rather than sharing the template's array", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		expect(session.categories).not.toBe(belote.categories);
		expect(session.categories[0]).not.toBe(belote.categories[0]);
	});

	it("omits an optional snapshot field the template does not set", async () => {
		const session = await createSession({
			template: wingspan,
			players: [{ name: "Marie", colorIndex: 1 }],
		});

		expect("targetScore" in session).toBe(false);
		expect("handTotal" in session).toBe(false);
		expect("entry" in session).toBe(false);
	});

	it("starts a sheet session with exactly one round, forever", async () => {
		const session = await createSession({
			template: wingspan,
			players: [{ name: "Marie", colorIndex: 1 }],
		});
		expect(session.rounds).toEqual([{}]);
	});

	it("starts a tally session with no hands yet", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		expect(session.rounds).toEqual([]);
	});

	it("gives each player an id and seat order in the order supplied", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});

		expect(session.players.map((p) => p.name)).toEqual(["Nous", "Eux"]);
		expect(session.players.map((p) => p.sortOrder)).toEqual([0, 1]);
		expect(session.players.map((p) => p.colorIndex)).toEqual([1, 2]);
		expect(new Set(session.players.map((p) => p.id)).size).toBe(2);
	});

	it("starts active, unfinished, and stamped with matching timestamps", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});

		expect(session.status).toBe("active");
		expect("finishedAt" in session).toBe(false);
		expect(session.createdAt).toBe(session.updatedAt);
		expect(Number.isNaN(Date.parse(session.createdAt))).toBe(false);
	});

	it("names the session after the template and the date by default", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
			now: new Date(2026, 3, 12, 19, 30),
		});
		expect(session.name).toBe("Belote 12 Apr");
	});

	it("keeps a name the caller supplies", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
			name: "Grudge match",
		});
		expect(session.name).toBe("Grudge match");
	});

	it("persists immediately, with no save step", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});

		closeDatabase();
		const stored = await getAllSessions();
		expect(stored).toEqual([session]);
	});
});

describe("updateSession", () => {
	it("writes a scored cell straight through to IndexedDB", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		const [nous, eux] = session.players;
		if (!nous || !eux) throw new Error("expected two players");

		await updateSession(session.id, {
			rounds: [{ [nous.id]: { hand: 82 }, [eux.id]: { hand: 78 } }],
		});

		closeDatabase();
		await loadSessions();
		const reloaded = getSessions().find((s) => s.id === session.id);
		expect(reloaded?.rounds[0]?.[nous.id]?.hand).toBe(82);
	});

	it("bumps updatedAt without touching createdAt", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-04-12T19:30:00.000Z"));
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});

		vi.setSystemTime(new Date("2026-04-12T21:00:00.000Z"));
		const updated = await updateSession(session.id, { name: "Renamed" });
		vi.useRealTimers();

		expect(updated.createdAt).toBe("2026-04-12T19:30:00.000Z");
		expect(updated.updatedAt).toBe("2026-04-12T21:00:00.000Z");
	});

	it("clears finishedAt when a finished session is reopened", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		await updateSession(session.id, {
			status: "finished",
			finishedAt: new Date().toISOString(),
		});

		const reopened = await updateSession(session.id, {
			status: "active",
			finishedAt: undefined,
		});

		expect(reopened.status).toBe("active");
		expect("finishedAt" in reopened).toBe(false);
	});

	it("leaves fields the patch does not mention alone", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		const updated = await updateSession(session.id, { name: "Renamed" });

		expect(updated.players).toEqual(session.players);
		expect(updated.categories).toEqual(session.categories);
		expect(updated.status).toBe("active");
	});

	it("does not lose a concurrent write to a different field", async () => {
		// Every write is read-modify-write. Two in flight at once both read the
		// same starting session, and the later publish silently reverts the
		// earlier one. There is no save action to notice it and retry.
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		const [nous] = session.players;
		if (!nous) throw new Error("expected a player");

		await Promise.all([
			updateSession(session.id, { name: "Renamed" }),
			updateSession(session.id, { rounds: [{ [nous.id]: { hand: 82 } }] }),
		]);

		const after = getSessions().find((s) => s.id === session.id);
		expect(after?.name).toBe("Renamed");
		expect(after?.rounds[0]?.[nous.id]?.hand).toBe(82);
	});

	it("rejects an id that does not exist rather than creating one", async () => {
		await expect(updateSession("nope", { name: "x" })).rejects.toThrow();
		expect(await getAllSessions()).toEqual([]);
	});

	it("cannot be asked to change the snapshot", () => {
		// The rule "a later template edit can never move a played score" is
		// expressed as a type here, not as a comment. If this ever compiles,
		// the snapshot has stopped being immutable.
		// @ts-expect-error categories is not a patchable field
		const patch: SessionPatch = { categories: [] };
		expect(patch).toBeDefined();
	});
});

describe("duplicateSession", () => {
	const scored = async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
			name: "Belote 12 Apr",
		});
		const [nous] = session.players;
		if (!nous) throw new Error("expected a player");
		return updateSession(session.id, {
			rounds: [{ [nous.id]: { hand: 82 } }],
			status: "finished",
			finishedAt: new Date().toISOString(),
		});
	};

	it("carries the template, snapshot and players across", async () => {
		const original = await scored();
		const copy = await duplicateSession(original.id);

		expect(copy.templateId).toBe(original.templateId);
		expect(copy.categories).toEqual(original.categories);
		expect(copy.win).toBe(original.win);
		expect(copy.targetScore).toBe(original.targetScore);
		expect(copy.players.map((p) => p.name)).toEqual(["Nous", "Eux"]);
		expect(copy.players.map((p) => p.colorIndex)).toEqual([1, 2]);
	});

	it("starts a fresh game rather than a copy of the finished one", async () => {
		const original = await scored();
		const copy = await duplicateSession(original.id);

		expect(copy.id).not.toBe(original.id);
		expect(copy.status).toBe("active");
		expect("finishedAt" in copy).toBe(false);
		expect(copy.rounds).toEqual([]);
	});

	it("gives the copy its own player records", async () => {
		const original = await scored();
		const copy = await duplicateSession(original.id);

		const originalIds = original.players.map((p) => p.id);
		expect(copy.players.every((p) => !originalIds.includes(p.id))).toBe(true);
	});

	it("leaves the original completely untouched", async () => {
		const original = await scored();
		await duplicateSession(original.id);

		const stored = (await getAllSessions()).find((s) => s.id === original.id);
		expect(stored).toEqual(original);
	});

	it("suffixes the copy without prompting", async () => {
		const original = await scored();
		const copy = await duplicateSession(original.id);
		expect(copy.name).toBe("Belote 12 Apr (2)");
	});

	it("increments past an existing copy instead of colliding", async () => {
		const original = await scored();
		await duplicateSession(original.id);
		const third = await duplicateSession(original.id);
		expect(third.name).toBe("Belote 12 Apr (3)");
	});

	it("duplicates a copy without stacking suffixes", async () => {
		const original = await scored();
		const second = await duplicateSession(original.id);
		const third = await duplicateSession(second.id);
		expect(third.name).toBe("Belote 12 Apr (3)");
	});

	it("gives two concurrent duplicates different names", async () => {
		const original = await scored();
		const [first, second] = await Promise.all([
			duplicateSession(original.id),
			duplicateSession(original.id),
		]);
		expect(first?.name).not.toBe(second?.name);
	});

	it("rejects duplicating a session that does not exist", async () => {
		await expect(duplicateSession("nope")).rejects.toThrow();
	});

	it("starts a duplicated sheet session with its one round", async () => {
		const original = await createSession({
			template: wingspan,
			players: [{ name: "Marie", colorIndex: 1 }],
		});
		const copy = await duplicateSession(original.id);
		expect(copy.rounds).toEqual([{}]);
	});
});

describe("nextCopyName", () => {
	it("takes (2) when the base name is the only one taken", () => {
		expect(nextCopyName("Belote", ["Belote"])).toBe("Belote (2)");
	});

	it("skips numbers already in use", () => {
		expect(nextCopyName("Belote", ["Belote", "Belote (2)"])).toBe("Belote (3)");
	});

	it("strips an existing suffix rather than nesting one", () => {
		expect(nextCopyName("Belote (2)", ["Belote", "Belote (2)"])).toBe(
			"Belote (3)",
		);
	});

	it("fills a gap left by a deleted copy", () => {
		expect(nextCopyName("Belote", ["Belote", "Belote (3)"])).toBe("Belote (2)");
	});

	it("leaves an unrelated name with a number in it alone", () => {
		expect(nextCopyName("Belote", ["Belote", "Uno (2)"])).toBe("Belote (2)");
	});
});

describe("defaultSessionName", () => {
	it("reads day-first in English, matching the artboards", () => {
		const name = defaultSessionName(belote, new Date(2026, 3, 12, 19, 30));
		expect(name).toBe("Belote 12 Apr");
	});

	it("localises the month in French", () => {
		const name = defaultSessionName(
			belote,
			new Date(2026, 3, 12, 19, 30),
			"fr",
		);
		expect(name).toBe("Belote 12 avr.");
	});
});

describe("removeSession", () => {
	it("deletes from storage and from the loaded store together", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		await removeSession(session.id);

		expect(getSessions()).toEqual([]);
		expect(await getAllSessions()).toEqual([]);
	});
});

describe("useSessions", () => {
	it("renders what is already loaded", async () => {
		await createSession({ template: belote, players: twoTeams });

		const { result } = renderHook(() => useSessions());
		expect(result.current).toHaveLength(1);
	});

	it("re-renders when a session is created", async () => {
		const { result } = renderHook(() => useSessions());
		expect(result.current).toEqual([]);

		await createSession({ template: belote, players: twoTeams });

		await waitFor(() => expect(result.current).toHaveLength(1));
	});

	it("hands back a list the caller cannot mutate", async () => {
		// Task 12 sorts this list. A caller reaching for .sort() or .push()
		// would rewrite the store in place, with no subscriber notified.
		await createSession({ template: belote, players: twoTeams });
		expect(() => {
			getSessions().push({} as never);
		}).toThrow();
	});

	it("hands back a stable reference when nothing has changed", () => {
		const { result, rerender } = renderHook(() => useSessions());
		const first = result.current;
		rerender();
		expect(result.current).toBe(first);
	});
});

describe("module boundaries", () => {
	const source = readFileSync("src/lib/sessions.ts", "utf8");

	it("imports no feature module", () => {
		expect(source).not.toMatch(/from "@\/features/);
	});

	it("uses React only for the store hook", () => {
		const reactImports = source.match(/^import .*from "react";$/gm) ?? [];
		expect(reactImports).toEqual([
			'import { useSyncExternalStore } from "react";',
		]);
	});
});

// Guards the plan's own verification for this task, end to end.
describe("a session survives a reload", () => {
	it("creates, scores, reloads from IndexedDB and reads the same value back", async () => {
		const session = await createSession({
			template: belote,
			players: twoTeams,
		});
		const [nous] = session.players;
		if (!nous) throw new Error("expected a player");

		await updateSession(session.id, { rounds: [{ [nous.id]: { hand: 82 } }] });
		await updateSession(session.id, {
			rounds: [{ [nous.id]: { hand: 82 } }, { [nous.id]: { hand: 105 } }],
		});

		closeDatabase();
		await loadSessions();

		const reloaded: Session | undefined = getSessions().find(
			(s) => s.id === session.id,
		);
		expect(reloaded?.rounds).toHaveLength(2);
		expect(reloaded?.rounds[1]?.[nous.id]?.hand).toBe(105);
	});
});

describe("writing one cell", () => {
	const seed = async () => {
		const session = await createSession({
			template: wingspan,
			players: [
				{ name: "Marie", colorIndex: 1 },
				{ name: "Luc", colorIndex: 2 },
			],
		});
		const [marie, luc] = session.players;
		if (!marie || !luc) throw new Error("seeded players missing");
		return { session, marie, luc };
	};

	it("keeps a cell written a moment earlier by somebody else", async () => {
		// The regression: a screen that patches `rounds` wholesale builds both
		// writes from one snapshot, and the second erases the first. Nothing in
		// this app has a save action to notice, so the number is simply gone.
		const { session, marie, luc } = await seed();

		const first = setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 5,
		});
		const second = setCell(session.id, {
			playerId: luc.id,
			categoryKey: "birds",
			value: 4,
		});
		await Promise.all([first, second]);

		const stored = await getSession(session.id);
		expect(stored?.rounds[0]?.[marie.id]?.birds).toBe(5);
		expect(stored?.rounds[0]?.[luc.id]?.birds).toBe(4);
	});

	it("removes a cell rather than storing a zero for it", async () => {
		const { session, marie } = await seed();
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 7,
		});
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: undefined,
		});

		const stored = await getSession(session.id);
		expect(stored?.rounds[0]?.[marie.id]?.birds).toBeUndefined();
	});

	it("keeps a typed zero, which is not an empty cell", async () => {
		const { session, marie } = await seed();
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 0,
		});

		const stored = await getSession(session.id);
		expect(stored?.rounds[0]?.[marie.id]?.birds).toBe(0);
	});

	it("grows the rounds array to reach the hand being written", async () => {
		const { session, marie } = await seed();
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 3,
			roundIndex: 2,
		});

		const stored = await getSession(session.id);
		expect(stored?.rounds).toHaveLength(3);
		expect(stored?.rounds[2]?.[marie.id]?.birds).toBe(3);
	});

	it("leaves no empty cell record behind when the last cell is cleared", async () => {
		const { session, marie, luc } = await seed();
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 7,
		});
		await setCell(session.id, {
			playerId: luc.id,
			categoryKey: "birds",
			value: 4,
		});
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: undefined,
		});

		// Marie is absent from the round, not present with an empty record —
		// otherwise "nobody scored this" and "somebody scored 0" read the same.
		const stored = await getSession(session.id);
		expect(stored?.rounds[0]).toEqual({ [luc.id]: { birds: 4 } });
	});

	/**
	 * The tally case: opening the entry sheet, typing a number and clearing it
	 * again used to leave a hand behind — a row of zeros in the ledger, a recap
	 * line naming somebody who never scored, and the hand counter one ahead.
	 */
	it("drops a trailing hand nobody entered", async () => {
		const { session, marie } = await seed();
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 5,
			roundIndex: 1,
		});
		expect((await getSession(session.id))?.rounds).toHaveLength(2);

		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: undefined,
			roundIndex: 1,
		});

		const stored = await getSession(session.id);
		expect(stored?.rounds).toHaveLength(0);
	});

	it("keeps an empty hand that has a played hand after it", async () => {
		const { session, marie } = await seed();
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 5,
			roundIndex: 2,
		});

		// Hands 1 and 2 were skipped, not abandoned: hand 3 is still hand 3.
		const stored = await getSession(session.id);
		expect(stored?.rounds).toHaveLength(3);
		expect(stored?.rounds[0]).toEqual({});
	});

	it("bumps updatedAt, so Home lifts the game being played", async () => {
		const { session, marie } = await seed();
		const before = session.updatedAt;
		await setCell(session.id, {
			playerId: marie.id,
			categoryKey: "birds",
			value: 1,
		});

		const stored = await getSession(session.id);
		expect((stored?.updatedAt ?? "") >= before).toBe(true);
	});
});
