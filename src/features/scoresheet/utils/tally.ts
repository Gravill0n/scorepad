import { type RankedPlayer, ranking, roundScore } from "@/lib/scoring";
import type { Round, Session } from "@/types/session";
import type { Category } from "@/types/template";

export type Density = "roomy" | "comfortable" | "compact";

/**
 * The standings row scales by getting denser, never wider. Derived at render
 * time from the player count — never persisted, never a preference.
 */
export const density = (playerCount: number): Density =>
	playerCount <= 3 ? "roomy" : playerCount <= 6 ? "comfortable" : "compact";

/**
 * `155 to go`. Negative once the target is passed, which is how the caller
 * knows to render the advisory line instead — passing a target never ends a
 * game. Undefined without a target: a counter has nowhere to go.
 */
export const toGo = (
	total: number,
	targetScore: number | undefined,
): number | undefined =>
	targetScore === undefined ? undefined : targetScore - total;

/**
 * The race bar's fill, 0–1. Progress when `win: "highest"`, distance to bust
 * when `"lowest"` — same fraction, and the colour says which.
 */
export const racebarFraction = (
	total: number,
	targetScore: number | undefined,
): number | undefined =>
	targetScore === undefined
		? undefined
		: Math.min(Math.max(total / targetScore, 0), 1);

/**
 * How far the hand is from the template's fixed total: 0 balanced, negative
 * with points still unplaced, positive when the moon is shot.
 *
 * **Advisory.** It is a number, not a verdict — nothing here can block a save,
 * because shooting the moon is legal play and the table is the authority.
 */
export const handBalance = (
	round: Round,
	categories: Category[],
	handTotal: number,
): number =>
	Object.keys(round).reduce(
		(placed, playerId) => placed + roundScore(round, playerId, categories),
		0,
	) - handTotal;

export type StandingsRow = RankedPlayer & {
	/** Undefined without a target score, so the row draws neither. */
	toGo: number | undefined;
	racebar: number | undefined;
};

type Standable = Pick<
	Session,
	"players" | "rounds" | "categories" | "win" | "targetScore"
>;

/**
 * The tally standings: every player, **in seat order**, carrying the rank
 * `ranking` gave them. Rank is a number in the margin — the person you are
 * looking for is where they were last hand. Sorting happens once, on Results.
 */
export const standings = (session: Standable): StandingsRow[] =>
	ranking(session)
		.map((ranked) => ({
			...ranked,
			toGo: toGo(ranked.total, session.targetScore),
			racebar: racebarFraction(ranked.total, session.targetScore),
		}))
		.sort((a, b) => a.player.sortOrder - b.player.sortOrder);
