import { cellScore, roundScore } from "@/lib/scoring";
import type { Round, Session } from "@/types/session";
import type { Category } from "@/types/template";

type Readable = Pick<
	Session,
	"mode" | "players" | "categories" | "rounds" | "win"
>;

/**
 * The contests a game is made of: one per category in sheet mode, one per hand
 * in tally. Each yields a score per player, in seat order — which is the only
 * difference between the two modes, so the counting below is written once.
 */
const contests = (session: Readable): number[][] => {
	const { players, categories, rounds } = session;

	if (session.mode === "tally") {
		return rounds.map((round) =>
			players.map((player) => roundScore(round, player.id, categories)),
		);
	}

	const entries = rounds[0] ?? {};
	return categories.map((category) =>
		players.map((player) => {
			const value = entries[player.id]?.[category.key];
			return Number.isFinite(value) ? cellScore(value as number, category) : 0;
		}),
	);
};

/** True where a cell was actually entered — a typed zero counts, absence doesn't. */
const entered = (round: Round, playerId: string, category: Category) =>
	round[playerId]?.[category.key] !== undefined;

export type Takeaway = { total: number; name: string; count: number };

/**
 * `4 OF 7 CATEGORIES · MARIE` — the mono line under the ranking.
 *
 * One line and one name: a count tie breaks on seat order, because this is a
 * closing remark rather than a second ranking. The ranking above it is where
 * a tie is preserved and marked.
 */
export const takeaway = (session: Readable): Takeaway | undefined => {
	const played = contests(session).filter((scores) =>
		scores.some((score) => score !== 0),
	);
	if (played.length === 0) return undefined;

	const wins = session.players.map(() => 0);
	for (const scores of played) {
		const best =
			session.win === "lowest" ? Math.min(...scores) : Math.max(...scores);
		scores.forEach((score, seat) => {
			if (score === best) wins[seat] = (wins[seat] ?? 0) + 1;
		});
	}

	const top = wins.indexOf(Math.max(...wins));
	const player = session.players[top];
	if (!player) return undefined;

	return { total: played.length, name: player.name, count: wins[top] ?? 0 };
};

/**
 * Cells nobody filled — an **advisory** on Results, never a block. A game
 * finished with holes in it is a legal thing to have done; the number is there
 * so nobody discovers the gap a week later.
 */
export const emptyCells = (session: Readable): number => {
	const { players, categories, rounds, mode } = session;

	if (mode === "tally") {
		return rounds.reduce(
			(missing, round) =>
				missing +
				players.filter(
					(player) =>
						!categories.every((category) =>
							entered(round, player.id, category),
						),
				).length,
			0,
		);
	}

	const entries = rounds[0] ?? {};
	return players.reduce(
		(missing, player) =>
			missing +
			categories.filter((category) => !entered(entries, player.id, category))
				.length,
		0,
	);
};
