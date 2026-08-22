import type { Player, Round, Session } from "@/types/session";
import type { Category } from "@/types/template";

/**
 * The only computation in the grammar. `multiplier` and `divideBy` are always
 * integers and the floor is unconditional — never express division as a
 * fractional multiplier, which is wrong at the first case.
 */
export const cellScore = (value: number, category: Category): number =>
	Math.floor((value * (category.multiplier ?? 1)) / (category.divideBy ?? 1));

/** Missing entries read as 0, so a partly-filled round scores what is there. */
export const roundScore = (
	round: Round,
	playerId: string,
	categories: Category[],
): number =>
	categories.reduce((sum, category) => {
		const entered = round[playerId]?.[category.key];
		// Missing data resolves to a defined zero. `?? 0` alone would let a
		// NaN from a corrupted import propagate into every total and out
		// through ranking, where NaN !== NaN yields rank 0.
		const value = Number.isFinite(entered) ? (entered as number) : 0;
		return sum + cellScore(value, category);
	}, 0);

/** A sheet is a tally with exactly one round, so this is the total in both modes. */
export const playerTotal = (
	rounds: Round[],
	playerId: string,
	categories: Category[],
): number =>
	rounds.reduce(
		(sum, round) => sum + roundScore(round, playerId, categories),
		0,
	);

export type RankedPlayer = {
	player: Player;
	total: number;
	/** Competition ranking: tied players share a number and the next one skips. */
	rank: number;
	/** The `=` marker is rendered from this; ranking resolves nothing. */
	tied: boolean;
};

/** Everything ranking needs, so a caller can rank without a whole Session. */
type Scorable = Pick<Session, "players" | "rounds" | "categories" | "win">;

/**
 * The one place sorting is allowed. Rows never reorder while scoring — rank is
 * a number in the margin — and a tie stays a tie.
 */
export const ranking = ({
	players,
	rounds,
	categories,
	win,
}: Scorable): RankedPlayer[] => {
	const scored = players
		.map((player) => ({
			player,
			total: playerTotal(rounds, player.id, categories),
		}))
		.sort((a, b) =>
			a.total === b.total
				? a.player.sortOrder - b.player.sortOrder
				: win === "lowest"
					? a.total - b.total
					: b.total - a.total,
		);

	return scored.map((entry, index) => ({
		...entry,
		rank: scored.findIndex((other) => other.total === entry.total) + 1,
		tied: scored.some((other, i) => i !== index && other.total === entry.total),
	}));
};
