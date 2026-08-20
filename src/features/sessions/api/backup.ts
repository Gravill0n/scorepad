import { z } from "zod";
import { getAllSessions, putMeta, putSession } from "@/lib/db";
import { loadSessions } from "@/lib/sessions";
import { type Session, sessionSchema } from "@/types/session";

/** Bumped only if the envelope changes. Sessions carry meta.schemaVersion. */
export const BACKUP_VERSION = 1;

/**
 * A backup file is untrusted input: it arrives from a filesystem, may have been
 * hand-edited, and may have been written by another version of the app. The
 * envelope is validated strictly; each session is validated on its own so one
 * unreadable game does not cost somebody the other nineteen.
 */
const backupSchema = z.object({
	version: z.int().positive(),
	exportedAt: z.string(),
	sessions: z.array(z.unknown()),
});

export type Backup = {
	version: number;
	exportedAt: string;
	sessions: Session[];
};

export type ImportResult = {
	/** Written to storage. */
	imported: number;
	/** Already present under the same id, so left alone. */
	skipped: number;
	/** Present in the file but not readable as a session. */
	rejected: number;
};

export const buildBackup = async (now: Date = new Date()): Promise<Backup> => ({
	version: BACKUP_VERSION,
	exportedAt: now.toISOString(),
	sessions: await getAllSessions(),
});

export const backupFilename = (now: Date = new Date()): string =>
	`scorepad-${now.toISOString().slice(0, 10)}.json`;

/**
 * Hands the file to the browser and stamps meta.lastExportedAt, which is what
 * the Home backup card renders and turns amber past a fortnight.
 */
export const exportBackup = async (now: Date = new Date()): Promise<Backup> => {
	const backup = await buildBackup(now);

	const url = URL.createObjectURL(
		new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
	);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = backupFilename(now);
	anchor.click();
	URL.revokeObjectURL(url);

	await putMeta("lastExportedAt", backup.exportedAt);
	return backup;
};

/** A reason code, not a sentence: the wording belongs in the message files. */
export type BackupProblem = "not-json" | "not-a-backup" | "too-new";

export class InvalidBackupError extends Error {
	readonly reason: BackupProblem;

	constructor(reason: BackupProblem) {
		super(reason);
		this.name = "InvalidBackupError";
		this.reason = reason;
	}
}

/**
 * Merges by `id`, skipping anything already stored. Importing the same file
 * twice changes nothing, and importing onto a populated phone never overwrites
 * a game that is further along than the backup's copy.
 */
export const importBackup = async (raw: unknown): Promise<ImportResult> => {
	const envelope = backupSchema.safeParse(raw);
	if (!envelope.success) {
		throw new InvalidBackupError("not-a-backup");
	}
	if (envelope.data.version > BACKUP_VERSION) {
		throw new InvalidBackupError("too-new");
	}

	const existing = new Set(
		(await getAllSessions()).map((session) => session.id),
	);
	const result: ImportResult = { imported: 0, skipped: 0, rejected: 0 };

	for (const candidate of envelope.data.sessions) {
		const parsed = sessionSchema.safeParse(candidate);
		if (!parsed.success) {
			result.rejected += 1;
			continue;
		}
		if (existing.has(parsed.data.id)) {
			result.skipped += 1;
			continue;
		}

		await putSession(parsed.data);
		existing.add(parsed.data.id);
		result.imported += 1;
	}

	await loadSessions();
	return result;
};

export const readBackupFile = async (file: File): Promise<unknown> => {
	try {
		return JSON.parse(await file.text());
	} catch {
		throw new InvalidBackupError("not-json");
	}
};
