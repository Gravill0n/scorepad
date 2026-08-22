import { z } from "zod";
import { getAllSessions, putMeta, putSession } from "@/lib/db";
import { loadSessions } from "@/lib/sessions";
import { importedSessionSchema, type Session } from "@/types/session";

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
/** Hands a backup to the browser as a download. */
const offerFile = (backup: Backup, filename: string): void => {
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
	);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	// In the document and revoked on a later tick: a detached anchor and a URL
	// revoked in the same task as the click both abort the download in Firefox,
	// and the failure is silent — the one export somebody made never lands.
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Every session on the phone, and the stamp Home's backup card renders and
 * turns amber past a fortnight.
 */
export const exportBackup = async (now: Date = new Date()): Promise<Backup> => {
	const backup = await buildBackup(now);
	offerFile(backup, backupFilename(now));

	await putMeta("lastExportedAt", backup.exportedAt);
	return backup;
};

/**
 * One finished game, in the same envelope — import merges by id, so a
 * single-session file restores the same way a whole backup does.
 *
 * **It does not stamp `lastExportedAt`.** That stamp is Home's promise that
 * everything on the phone is safe somewhere; keeping one game does not make
 * that true, and a stale-backup warning silenced by the wrong export is the
 * kind of thing nobody notices until they need the file.
 */
export const exportSession = (
	session: Session,
	now: Date = new Date(),
): Backup => {
	const backup: Backup = {
		version: BACKUP_VERSION,
		exportedAt: now.toISOString(),
		sessions: [session],
	};
	offerFile(backup, backupFilename(now));
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
		// The strict schema, not the one storage reads with: a non-numeric cell
		// is refused rather than silently zeroed (task 14).
		const parsed = importedSessionSchema.safeParse(candidate);
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
