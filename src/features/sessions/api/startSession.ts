import { getMeta, putMeta, RECENT_NAMES_CAP } from "@/lib/db";
import { createSession } from "@/lib/sessions";
import type { Session } from "@/types/session";
import type { Template } from "@/types/template";
import type { SetupRow } from "../utils/setupRows";

/**
 * Most recent first, deduplicated case-insensitively, capped. These are the
 * pills on the setup screen: the point is that the second game night is four
 * taps, so the order is "who played last", not the alphabet.
 */
export const mergeRecentNames = (
	existing: string[],
	added: string[],
): string[] => {
	const merged: string[] = [];
	const seen = new Set<string>();

	for (const name of [...added, ...existing]) {
		const trimmed = name.trim();
		const key = trimmed.toLocaleLowerCase();
		if (trimmed === "" || seen.has(key)) continue;
		seen.add(key);
		merged.push(trimmed);
	}

	return merged.slice(0, RECENT_NAMES_CAP);
};

/**
 * Ask the browser to keep this origin's storage. Every score in this app lives
 * in IndexedDB and nowhere else, so eviction is the one failure that loses
 * somebody's evening.
 *
 * The result is logged rather than surfaced: it is a durability signal for us,
 * not a decision anybody at a table can act on. Asking again when permission
 * is already granted is a no-op, so it is skipped.
 */
export const requestPersistence = async (): Promise<boolean | undefined> => {
	const storage = navigator.storage;
	if (!storage?.persist) return undefined;

	if (await storage.persisted?.()) return true;

	const granted = await storage.persist();
	console.info(`navigator.storage.persist(): ${granted}`);
	return granted;
};

/**
 * The write that starts the game: snapshot the template into a session, keep
 * the names for next time, and ask for durable storage.
 *
 * Persistence is requested but never awaited into the navigation — a slow or
 * absent permission prompt must not stand between somebody and the first hand.
 */
export const startSession = async ({
	template,
	rows,
	locale,
}: {
	template: Template;
	rows: SetupRow[];
	locale?: "en" | "fr";
}): Promise<Session> => {
	const players = rows.map((row) => ({
		name: row.name.trim(),
		colorIndex: row.colorIndex,
	}));

	const session = await createSession({ template, players, locale });

	const existing = (await getMeta("recentNames")) ?? [];
	await putMeta(
		"recentNames",
		mergeRecentNames(
			existing,
			players.map((player) => player.name),
		),
	);

	void requestPersistence();
	return session;
};
