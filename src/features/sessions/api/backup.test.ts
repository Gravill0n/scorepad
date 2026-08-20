import { closeDatabase, getAllSessions, putSession } from "@/lib/db";
import { createSession, loadSessions } from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import type { Session } from "@/types/session";
import type { Template } from "@/types/template";
import {
	BACKUP_VERSION,
	backupFilename,
	buildBackup,
	InvalidBackupError,
	importBackup,
} from "./backup";

const belote = templates.find((t) => t.id === "belote") as Template;

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const seed = (name: string) =>
	createSession({
		template: belote,
		players: [
			{ name: "Nous", colorIndex: 1 },
			{ name: "Eux", colorIndex: 2 },
		],
		name,
	});

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

describe("buildBackup", () => {
	it("carries every stored session and stamps the envelope", async () => {
		await seed("One");
		await seed("Two");

		const backup = await buildBackup(new Date("2026-04-12T20:00:00.000Z"));

		expect(backup.version).toBe(BACKUP_VERSION);
		expect(backup.exportedAt).toBe("2026-04-12T20:00:00.000Z");
		expect(backup.sessions).toHaveLength(2);
	});

	it("names the file by the day it was written", () => {
		expect(backupFilename(new Date("2026-04-12T20:00:00.000Z"))).toBe(
			"scorepad-2026-04-12.json",
		);
	});
});

describe("success criterion 5: export, wipe, import", () => {
	it("restores every session byte-identically", async () => {
		await seed("Belote 12 Apr");
		await seed("Camping");
		const before = await getAllSessions();
		const backup = await buildBackup();

		closeDatabase();
		await wipeDatabase();
		await loadSessions();
		expect(await getAllSessions()).toEqual([]);

		const result = await importBackup(JSON.parse(JSON.stringify(backup)));

		expect(result).toEqual({ imported: 2, skipped: 0, rejected: 0 });
		const after = await getAllSessions();
		expect(sortById(after)).toEqual(sortById(before));
	});
});

const sortById = (sessions: Session[]) =>
	[...sessions].sort((a, b) => a.id.localeCompare(b.id));

describe("importBackup", () => {
	it("merges by id, leaving a session it already holds alone", async () => {
		const kept = await seed("Belote 12 Apr");
		const backup = await buildBackup();

		const result = await importBackup(backup);

		expect(result).toEqual({ imported: 0, skipped: 1, rejected: 0 });
		expect(await getAllSessions()).toHaveLength(1);
		expect((await getAllSessions())[0]?.name).toBe(kept.name);
	});

	it("never overwrites a game further along than the backup's copy", async () => {
		const session = await seed("Belote 12 Apr");
		const stale = await buildBackup();

		// The phone plays on after the backup was taken.
		await putSession({ ...session, rounds: [{ p1: { hand: 82 } }] });
		await importBackup(stale);

		expect((await getAllSessions())[0]?.rounds).toEqual([{ p1: { hand: 82 } }]);
	});

	it("is idempotent — importing the same file twice changes nothing", async () => {
		await seed("Belote 12 Apr");
		const backup = await buildBackup();
		closeDatabase();
		await wipeDatabase();
		await loadSessions();

		await importBackup(backup);
		const second = await importBackup(backup);

		expect(second).toEqual({ imported: 0, skipped: 1, rejected: 0 });
		expect(await getAllSessions()).toHaveLength(1);
	});

	it("refuses a file that is not a backup", async () => {
		await expect(importBackup({ hello: "world" })).rejects.toThrow(
			InvalidBackupError,
		);
		await expect(importBackup(null)).rejects.toThrow(InvalidBackupError);
	});

	it("refuses a backup from a newer version rather than guessing", async () => {
		await expect(
			importBackup({ version: 99, exportedAt: "", sessions: [] }),
		).rejects.toThrow(/too-new/);
	});

	it("rejects an unreadable session without losing the readable ones", async () => {
		await seed("Good");
		const backup = await buildBackup();
		closeDatabase();
		await wipeDatabase();
		await loadSessions();

		const result = await importBackup({
			...backup,
			sessions: [...backup.sessions, { id: "broken", name: "Broken" }],
		});

		expect(result).toEqual({ imported: 1, skipped: 0, rejected: 1 });
		expect(await getAllSessions()).toHaveLength(1);
	});

	it("resolves a corrupted cell to zero rather than rejecting the game", async () => {
		const session = await seed("Belote 12 Apr");
		const backup = await buildBackup();
		closeDatabase();
		await wipeDatabase();
		await loadSessions();

		const tampered = {
			...backup,
			sessions: [{ ...session, rounds: [{ p1: { hand: "not a number" } }] }],
		};
		const result = await importBackup(tampered);

		expect(result.imported).toBe(1);
		expect((await getAllSessions())[0]?.rounds[0]?.p1?.hand).toBe(0);
	});

	it("leaves the loaded store agreeing with storage", async () => {
		const backup = await buildBackup();
		await seed("Later");
		await importBackup(backup);

		const { getSessions } = await import("@/lib/sessions");
		expect(getSessions()).toHaveLength((await getAllSessions()).length);
	});
});
