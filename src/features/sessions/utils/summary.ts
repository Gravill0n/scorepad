import { playerTotal, ranking } from "@/lib/scoring";
import type { Player, Session } from "@/types/session";

export type SessionProgress =
	| { mode: "tally"; hand: number }
	| { mode: "sheet"; category: number; total: number };

/**
 * How far along a session is, for the Home row's `hand 14` / `category 2 of 7`.
 *
 * Tally points at the hand about to be played, which is what the standings
 * screen's `Enter hand N →` says for the same session. Sheet points at the
 * first category nobody has filled in — a gap earlier in the sheet is still the
 * next thing to do, so this is a scan for the first hole rather than a count of
 * how many are filled.
 */
export const sessionProgress = (session: Session): SessionProgress => {
	if (session.mode === "tally") {
		return { mode: "tally", hand: session.rounds.length + 1 };
	}

	const entries = session.rounds[0] ?? {};
	const isFilled = (key: string) =>
		Object.values(entries).some((cells) => cells[key] !== undefined);

	const firstEmpty = session.categories.findIndex(
		(category) => !isFilled(category.key),
	);
	const total = session.categories.length;

	return {
		mode: "sheet",
		// Every category filled: stay on the last one rather than reporting an
		// eighth category of seven.
		category: firstEmpty === -1 ? total : firstEmpty + 1,
		total,
	};
};

/**
 * One total per player, in seat order. Home's standing line is a glance, not a
 * ranking — sorting happens exactly once, on Results.
 */
export const sessionTotals = (session: Session): number[] =>
	session.players.map((player) =>
		playerTotal(session.rounds, player.id, session.categories),
	);

/** Everyone sharing rank 1. More than one means a tie, which stays a tie. */
export const sessionWinners = (session: Session): Player[] =>
	ranking(session)
		.filter((entry) => entry.rank === 1)
		.map((entry) => entry.player);
