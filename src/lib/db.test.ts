import { readFileSync } from "node:fs";
import type { Session } from "@/types/session";
import {
	closeDatabase,
	deleteSession,
	getAllSessions,
	getMeta,
	getSession,
	openDatabase,
	putMeta,
	putRecentNames,
	putSession,
	RECENT_NAMES_CAP,
	runMigrations,
	SCHEMA_VERSION,
} from "./db";

const wipeDatabase = () =>
	new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => resolve();
	});

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Belote 12 Apr",
	templateId: "belote",
	mode: "tally",
	categories: [{ key: "hand", label: "Hand points" }],
	win: "highest",
	targetScore: 501,
	entry: "team",
	players: [
		{ id: "p1", name: "Nous", colorIndex: 1, sortOrder: 0 },
		{ id: "p2", name: "Eux", colorIndex: 2, sortOrder: 1 },
	],
	rounds: [{ p1: { hand: 82 }, p2: { hand: 78 } }],
	status: "active",
	createdAt: "2026-04-12T19:30:00.000Z",
	updatedAt: "2026-04-12T19:30:00.000Z",
	...overrides,
});

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
});

describe("the database", () => {
	it("holds exactly two object stores", async () => {
		const db = await openDatabase();
		expect([...db.objectStoreNames].sort()).toEqual(["meta", "sessions"]);
	});

	it("keys sessions by id and meta by key", async () => {
		const db = await openDatabase();
		const tx = db.transaction(["sessions", "meta"], "readonly");
		expect(tx.objectStore("sessions").keyPath).toBe("id");
		expect(tx.objectStore("meta").keyPath).toBe("key");
	});

	it("writes no setting into meta when it opens", () => {
		// data-model.md scopes this rule to locale and theme: "the last two are
		// the only settings the app has; absent means untouched, which is not
		// the same as a stored default."
		return Promise.all([
			expect(getMeta("locale")).resolves.toBeUndefined(),
			expect(getMeta("theme")).resolves.toBeUndefined(),
			expect(getMeta("recentNames")).resolves.toBeUndefined(),
			expect(getMeta("lastExportedAt")).resolves.toBeUndefined(),
		]);
	});

	it("stamps schemaVersion when the database is created", async () => {
		// Bookkeeping, not a setting. Without the stamp, a database created by a
		// future v3 app would hold no version, and the next open would read
		// "absent", assume v1, and re-run migrations over current data.
		await openDatabase();
		expect(await getMeta("schemaVersion")).toBe(SCHEMA_VERSION);
	});

	it("surfaces an open failure instead of resolving to an empty store", async () => {
		closeDatabase();
		const open = vi.spyOn(indexedDB, "open").mockImplementation(() => {
			const request = {} as IDBOpenDBRequest;
			queueMicrotask(() => {
				Object.defineProperty(request, "error", {
					value: new DOMException("boom"),
				});
				request.onerror?.(new Event("error") as never);
			});
			return request;
		});

		await expect(openDatabase()).rejects.toThrow();
		open.mockRestore();
	});
});

describe("sessions", () => {
	it("reads back a session identical to the one written, across a reopen", async () => {
		const written = session();
		await putSession(written);

		closeDatabase();
		const read = await getSession("s1");

		expect(read).toEqual(written);
	});

	it("round-trips a 15-round tally session without losing a hand", async () => {
		const rounds = Array.from({ length: 15 }, (_, hand) => ({
			p1: { hand: hand * 7 },
			p2: { hand: hand * 3 },
		}));
		await putSession(session({ rounds }));

		closeDatabase();
		const read = await getSession("s1");

		expect(read?.rounds).toHaveLength(15);
		expect(read?.rounds).toEqual(rounds);
	});

	it("returns undefined for a session that does not exist", async () => {
		expect(await getSession("nope")).toBeUndefined();
	});

	it("overwrites a session written under the same id", async () => {
		await putSession(session({ name: "First" }));
		await putSession(session({ name: "Second" }));

		expect(await getAllSessions()).toHaveLength(1);
		expect((await getSession("s1"))?.name).toBe("Second");
	});

	it("lists every stored session", async () => {
		await putSession(session({ id: "a" }));
		await putSession(session({ id: "b" }));

		const ids = (await getAllSessions()).map((s) => s.id).sort();
		expect(ids).toEqual(["a", "b"]);
	});

	it("returns an empty list when nothing is stored", async () => {
		expect(await getAllSessions()).toEqual([]);
	});

	it("deletes a session and leaves the others alone", async () => {
		await putSession(session({ id: "a" }));
		await putSession(session({ id: "b" }));

		await deleteSession("a");

		expect((await getAllSessions()).map((s) => s.id)).toEqual(["b"]);
	});

	it("rejects a write it cannot store rather than reporting success", async () => {
		// There is no save action anywhere in this app, so a write that quietly
		// resolves without storing is unrecoverable — nothing retries it.
		const unstorable = { ...session(), onSave: () => {} } as unknown as Session;

		await expect(putSession(unstorable)).rejects.toThrow();
		expect(await getAllSessions()).toEqual([]);
	});

	it("preserves an optional field that is absent rather than inventing it", async () => {
		const withoutTarget = session();
		delete withoutTarget.targetScore;
		await putSession(withoutTarget);

		const read = await getSession("s1");
		expect(read && "targetScore" in read).toBe(false);
	});
});

describe("reading a record that does not match the schema", () => {
	/** Writes straight past the typed API, the way corruption actually arrives. */
	const putRaw = async (record: unknown) => {
		const db = await openDatabase();
		const transaction = db.transaction("sessions", "readwrite");
		transaction.objectStore("sessions").put(record);
		await new Promise((resolve) => {
			transaction.oncomplete = resolve;
		});
	};

	const countStored = async () => {
		const db = await openDatabase();
		const store = db
			.transaction("sessions", "readonly")
			.objectStore("sessions");
		return new Promise<number>((resolve) => {
			const request = store.count();
			request.onsuccess = () => resolve(request.result);
		});
	};

	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps the good sessions when one is structurally broken", async () => {
		await putSession(session({ id: "good" }));
		await putRaw({ id: "broken", name: "Broken", players: "not an array" });

		const all = await getAllSessions();
		expect(all.map((s) => s.id)).toEqual(["good"]);
	});

	it("reports a broken record rather than dropping it silently", async () => {
		await putRaw({ id: "broken", name: "Broken" });
		await getAllSessions();

		expect(console.error).toHaveBeenCalled();
		expect(vi.mocked(console.error).mock.calls[0]?.join(" ")).toContain(
			"broken",
		);
	});

	it("leaves the broken record in storage rather than deleting it", async () => {
		await putRaw({ id: "broken", name: "Broken" });
		await getAllSessions();

		expect(await countStored()).toBe(1);
	});

	it("returns undefined for a single broken session", async () => {
		await putRaw({ id: "broken", name: "Broken" });
		expect(await getSession("broken")).toBeUndefined();
	});

	it("resolves a corrupted cell to zero rather than losing the whole game", async () => {
		// A NaN in one cell is not a reason to make an evening's game vanish.
		// scoring.ts already treats a non-finite entry as zero; this is the same
		// rule applied at the storage boundary.
		await putRaw({
			...session({ id: "s1" }),
			rounds: [{ p1: { hand: Number.NaN }, p2: { hand: 78 } }],
		});

		const read = await getSession("s1");
		expect(read?.rounds[0]?.p1?.hand).toBe(0);
		expect(read?.rounds[0]?.p2?.hand).toBe(78);
	});

	it("drops a key the schema does not define, rather than passing it through", async () => {
		// The deliberate trade-off: a record written by a newer app version loses
		// its new fields when an older version reads and rewrites it. Ordered
		// migrations are how this app changes a record's shape; silent
		// passthrough would be a second, competing mechanism, and it would cost
		// exact typing on every property access in the app.
		await putRaw({ ...session({ id: "s1" }), fieldFromTheFuture: 42 });

		const read = await getSession("s1");
		expect(read && "fieldFromTheFuture" in read).toBe(false);
	});

	it("accepts a well-formed session unchanged", async () => {
		const written = session();
		await putSession(written);
		expect(await getSession("s1")).toEqual(written);
	});
});

describe("meta", () => {
	it("returns undefined for an untouched setting, which is not a stored default", async () => {
		expect(await getMeta("locale")).toBeUndefined();
		expect(await getMeta("theme")).toBeUndefined();
		expect(await getMeta("lastExportedAt")).toBeUndefined();
	});

	it("round-trips a stored setting", async () => {
		await putMeta("locale", "fr");
		closeDatabase();
		expect(await getMeta("locale")).toBe("fr");
	});

	it("round-trips a null lastExportedAt distinctly from absence", async () => {
		await putMeta("lastExportedAt", null);
		expect(await getMeta("lastExportedAt")).toBeNull();
	});

	it("caps recent names at twenty, keeping the most recent", async () => {
		const names = Array.from({ length: 30 }, (_, i) => `player${i}`);
		await putRecentNames(names);

		const stored = await getMeta("recentNames");
		expect(stored).toHaveLength(RECENT_NAMES_CAP);
		expect(stored?.[0]).toBe("player0");
		expect(stored?.at(-1)).toBe("player19");
	});

	it("stores a shorter list of names untouched", async () => {
		await putRecentNames(["Marie", "Luc"]);
		expect(await getMeta("recentNames")).toEqual(["Marie", "Luc"]);
	});
});

describe("the migration runner", () => {
	it("ships version 1 with no migrations, so opening runs nothing", async () => {
		const db = await openDatabase();
		expect(SCHEMA_VERSION).toBe(1);
		expect(await runMigrations(db, SCHEMA_VERSION, SCHEMA_VERSION, [])).toBe(1);
	});

	it("runs every migration above the stored version, in order", async () => {
		const db = await openDatabase();
		const ran: number[] = [];
		const migrations = [
			{ version: 3, migrate: async () => void ran.push(3) },
			{ version: 2, migrate: async () => void ran.push(2) },
			{ version: 4, migrate: async () => void ran.push(4) },
		];

		await runMigrations(db, 1, 4, migrations);

		expect(ran).toEqual([2, 3, 4]);
	});

	it("skips migrations at or below the stored version", async () => {
		const db = await openDatabase();
		const ran: number[] = [];
		const migrations = [
			{ version: 2, migrate: async () => void ran.push(2) },
			{ version: 3, migrate: async () => void ran.push(3) },
		];

		await runMigrations(db, 2, 3, migrations);

		expect(ran).toEqual([3]);
	});

	it("runs nothing when the stored version already matches", async () => {
		const db = await openDatabase();
		const ran: number[] = [];
		await runMigrations(db, 3, 3, [
			{ version: 2, migrate: async () => void ran.push(2) },
		]);
		expect(ran).toEqual([]);
	});

	it("records the new version once migrations have run", async () => {
		const db = await openDatabase();
		await runMigrations(db, 1, 2, [{ version: 2, migrate: async () => {} }]);
		expect(await getMeta("schemaVersion")).toBe(2);
	});

	it("leaves the recorded version alone when there was nothing to migrate", async () => {
		const db = await openDatabase();
		await runMigrations(db, 1, 1, []);
		expect(await getMeta("schemaVersion")).toBe(SCHEMA_VERSION);
	});
});

describe("module boundaries", () => {
	it("keeps fake-indexeddb out of src entirely", () => {
		const source = readFileSync("src/lib/db.ts", "utf8");
		expect(source).not.toMatch(/fake-indexeddb/);
	});

	it("imports no React and no feature module", () => {
		const source = readFileSync("src/lib/db.ts", "utf8");
		expect(source).not.toMatch(/from "react/);
		expect(source).not.toMatch(/from "@\/features/);
	});
});
