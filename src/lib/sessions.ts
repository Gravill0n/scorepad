import { useSyncExternalStore } from "react";
import {
	deleteSession,
	getAllSessions,
	getSession,
	putSession,
} from "@/lib/db";
import type { Session } from "@/types/session";
import type { Template } from "@/types/template";
import { newId } from "@/utils/newId";

export type NewPlayer = { name: string; colorIndex: number };

export type CreateSessionInput = {
	template: Template;
	/** In seat order. Ids and sortOrder are assigned here. */
	players: NewPlayer[];
	/** Defaults to the template name and the date, e.g. "Belote 12 Apr". */
	name?: string;
	locale?: "en" | "fr";
	/** Overridable so a caller can date a session deterministically. */
	now?: Date;
};

/**
 * The fields a session may change after it exists.
 *
 * The snapshot — `categories`, `win`, `targetScore`, `tiebreakNote`,
 * `handTotal`, `entry`, `mode`, `templateId` — is absent by construction. "A
 * later template edit can never move a played score" is expressed here as a
 * type rather than as a comment somebody has to remember.
 *
 * A key present with `undefined` clears it; a key left out is untouched.
 */
export type SessionPatch = Partial<
	Pick<Session, "name" | "players" | "rounds" | "status" | "finishedAt">
>;

/** "12 Apr", not "Apr 12" — both app locales read day-first, per the artboards. */
const DATE_LOCALES = { en: "en-GB", fr: "fr-FR" } as const;

export const defaultSessionName = (
	template: Template,
	now: Date,
	locale: "en" | "fr" = "en",
): string => {
	const date = new Intl.DateTimeFormat(DATE_LOCALES[locale], {
		day: "numeric",
		month: "short",
	}).format(now);
	return `${template.name} ${date}`;
};

/**
 * `Belote 12 Apr` → `Belote 12 Apr (2)`, incrementing past one that exists.
 * Duplicating a copy re-uses the base rather than nesting suffixes. No prompt —
 * renaming afterwards is the ⋯ menu's job.
 */
export const nextCopyName = (name: string, existing: string[]): string => {
	const base = name.replace(/ \(\d+\)$/, "");
	const taken = new Set<number>();

	for (const other of existing) {
		if (other === base) {
			taken.add(1);
			continue;
		}
		const match = other.match(/^(.*) \((\d+)\)$/);
		if (match?.[1] === base && match[2]) taken.add(Number(match[2]));
	}

	let suffix = 2;
	while (taken.has(suffix)) suffix += 1;
	return `${base} (${suffix})`;
};

// ---- The loaded store -------------------------------------------------------

let loaded: Session[] = [];
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

/** The current snapshot. Reference-stable until something actually changes. */
export const getSessions = (): Session[] => loaded;

const publish = (next: Session[]) => {
	// Frozen because task 12 sorts this list. A caller reaching for .sort() or
	// .push() would otherwise rewrite the store in place, with no subscriber
	// notified — a silent corruption that fails loudly instead.
	loaded = Object.freeze(next) as Session[];
	for (const listener of listeners) listener();
};

let writes: Promise<unknown> = Promise.resolve();

/**
 * Every write here is read-modify-write. Two in flight at once both read the
 * same starting session, and whichever publishes last silently reverts the
 * other — a rename lost to a score entered at the same moment, with no save
 * action anywhere to notice and retry. Serialising them costs one promise
 * chain; a session is small and a write is a single IndexedDB transaction.
 */
const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
	const result = writes.then(operation, operation);
	writes = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
};

export const useSessions = (): Session[] =>
	useSyncExternalStore(subscribe, getSessions, getSessions);

/**
 * "loading" until the first read finishes. Without it every screen that asks
 * `sessions.length === 0` claims the user has no games during the read, and
 * Home flashes its first-run empty state at somebody with twenty sessions.
 */
let status: "loading" | "ready" = "loading";
const getStatus = () => status;

export const useSessionsStatus = (): "loading" | "ready" =>
	useSyncExternalStore(subscribe, getStatus, getStatus);

export const loadSessions = async (): Promise<Session[]> => {
	const all = await getAllSessions();
	status = "ready";
	publish(all);
	return loaded;
};

/**
 * Writes first, then publishes. If the write throws, the store keeps the value
 * that is actually on disk — the alternative is a screen showing a score that
 * was never stored, and there is no save action to retry.
 */
const persist = async (session: Session): Promise<Session> => {
	await putSession(session);

	publish(
		loaded.some((existing) => existing.id === session.id)
			? loaded.map((existing) =>
					existing.id === session.id ? session : existing,
				)
			: [...loaded, session],
	);

	return session;
};

const mustFind = async (id: string): Promise<Session> => {
	const session =
		loaded.find((existing) => existing.id === id) ?? (await getSession(id));
	if (!session) throw new Error(`no session with id "${id}"`);
	return session;
};

// ---- Operations -------------------------------------------------------------

export const createSession = ({
	template,
	players,
	name,
	locale,
	now = new Date(),
}: CreateSessionInput): Promise<Session> =>
	serialize(async () => {
		const timestamp = now.toISOString();

		return persist({
			id: newId(),
			name: name ?? defaultSessionName(template, now, locale),
			templateId: template.id,
			// The snapshot. Optional fields are spread conditionally so an absent one
			// stays absent rather than being stored as an explicit undefined.
			mode: template.mode,
			categories: template.categories.map((category) => ({ ...category })),
			win: template.win,
			...(template.targetScore !== undefined && {
				targetScore: template.targetScore,
			}),
			...(template.tiebreakNote !== undefined && {
				tiebreakNote: template.tiebreakNote,
			}),
			...(template.handTotal !== undefined && {
				handTotal: template.handTotal,
			}),
			...(template.entry !== undefined && { entry: template.entry }),
			players: players.map((player, index) => ({
				id: newId(),
				name: player.name,
				colorIndex: player.colorIndex,
				sortOrder: index,
			})),
			// A sheet is a tally with exactly one round, and it never grows.
			rounds: template.mode === "sheet" ? [{}] : [],
			status: "active",
			createdAt: timestamp,
			updatedAt: timestamp,
		});
	});

export const updateSession = (
	id: string,
	patch: SessionPatch,
): Promise<Session> =>
	serialize(async () => {
		const current = await mustFind(id);
		const merged: Session = {
			...current,
			...patch,
			updatedAt: new Date().toISOString(),
		};

		// Reopening a finished session clears the stamp rather than storing an
		// explicit undefined, which `"finishedAt" in session` would still see.
		if ("finishedAt" in patch && patch.finishedAt === undefined) {
			delete merged.finishedAt;
		}

		return persist(merged);
	});

/**
 * Home's swipe action and Results' `Play again` are the same call: a new active
 * session with the same template, snapshot and players, and no scores. The
 * original is never touched.
 */
export const duplicateSession = (id: string): Promise<Session> =>
	serialize(async () => {
		const source = await mustFind(id);
		const timestamp = new Date().toISOString();
		const names = (await getAllSessions()).map((session) => session.name);

		const copy: Session = {
			...source,
			id: newId(),
			name: nextCopyName(source.name, names),
			players: source.players.map((player) => ({
				...player,
				id: newId(),
			})),
			rounds: source.mode === "sheet" ? [{}] : [],
			status: "active",
			createdAt: timestamp,
			updatedAt: timestamp,
		};
		delete copy.finishedAt;

		return persist(copy);
	});

/**
 * One cell, written inside the serialised operation.
 *
 * The alternative — patching `rounds` wholesale from what a screen last
 * rendered — loses data: two cells entered in quick succession are both built
 * from the same snapshot, and the second write erases the first. There is no
 * save action anywhere to notice, and the number simply is not there when
 * somebody looks up. Reading the current session here is what makes "every
 * cell edit persists immediately" safe rather than merely prompt.
 *
 * `undefined` **removes** the cell: an empty cell and a scored zero are
 * different facts, and Results warns about the first.
 */
export const setCell = (
	id: string,
	{
		playerId,
		categoryKey,
		value,
		roundIndex = 0,
	}: {
		playerId: string;
		categoryKey: string;
		value: number | undefined;
		/** Sheet mode always writes round 0; tally writes the hand being entered. */
		roundIndex?: number;
	},
): Promise<Session> =>
	serialize(async () => {
		const current = await mustFind(id);

		const rounds = [...current.rounds];
		while (rounds.length <= roundIndex) rounds.push({});

		const round = { ...(rounds[roundIndex] ?? {}) };
		const cells = { ...(round[playerId] ?? {}) };
		if (value === undefined) delete cells[categoryKey];
		else cells[categoryKey] = value;

		// An empty cell is *absent* from the round rather than stored as zero, so
		// Results can still tell "nobody scored this" from "somebody scored 0".
		// A player left with no cells at all is absent by the same rule.
		if (Object.keys(cells).length === 0) delete round[playerId];
		else round[playerId] = cells;

		rounds[roundIndex] = round;

		// A trailing hand nobody entered is not a hand. Without this, opening the
		// entry sheet, typing a number and clearing it again leaves a row of zeros
		// in the ledger, a recap line naming somebody who never scored, and the
		// hand counter one ahead of the table.
		while (
			rounds.length > 0 &&
			Object.keys(rounds[rounds.length - 1] ?? {}).length === 0
		) {
			rounds.pop();
		}

		return persist({
			...current,
			rounds,
			updatedAt: new Date().toISOString(),
		});
	});

export const removeSession = (id: string): Promise<void> =>
	serialize(async () => {
		await deleteSession(id);
		publish(loaded.filter((session) => session.id !== id));
	});
