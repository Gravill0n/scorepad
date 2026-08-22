import {
	playerTotal,
	type RankedPlayer,
	ranking,
	roundScore,
} from "@/lib/scoring";
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

/** What the whole table has put into one hand — the `7 PLACED` half of `2c`. */
export const handPlaced = (round: Round, categories: Category[]): number =>
	Object.keys(round).reduce(
		(placed, playerId) => placed + roundScore(round, playerId, categories),
		0,
	);

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
): number => handPlaced(round, categories) - handTotal;

export type StandingsRow = RankedPlayer & {
	/** Undefined without a target score, so the row draws neither. */
	toGo: number | undefined;
	racebar: number | undefined;
	/** Hands taken. The first clause the row sheds as the table grows. */
	handsWon: number;
	/** This player's score in the hand just played. Undefined before hand 1. */
	lastHand: number | undefined;
};

type Standable = Pick<
	Session,
	"players" | "rounds" | "categories" | "win" | "targetScore"
>;

/** Every player's score in one hand, in seat order. */
const handScores = (
	{ players, categories }: Pick<Standable, "players" | "categories">,
	round: Round,
): number[] =>
	players.map((player) => roundScore(round, player.id, categories));

/**
 * Who took a hand: the best score in it, per `win`. A tie credits everyone who
 * tied — this module resolves nothing. A hand nobody has entered is taken by
 * nobody, which is not the same as everybody drawing zero.
 */
const handTakers = (session: Standable, round: Round): boolean[] => {
	const scores = handScores(session, round);
	if (Object.keys(round).length === 0) return scores.map(() => false);

	const best =
		session.win === "lowest" ? Math.min(...scores) : Math.max(...scores);
	return scores.map((score) => score === best);
};

export type HandRecap = { hand: number; name: string; score: number };

/**
 * `HAND 14 · CHLOÉ TOOK 60` — the recap line above the standings. The first
 * taker in seat order when a hand ties, because the line has room for one name
 * and the rows below already carry the rest.
 */
export const lastHandRecap = (session: Standable): HandRecap | undefined => {
	const hand = session.rounds.length;
	const round = session.rounds[hand - 1];
	if (round === undefined) return undefined;

	const taker = handTakers(session, round).indexOf(true);
	const player = session.players[taker];
	if (player === undefined) return undefined;

	return {
		hand,
		name: player.name,
		score: roundScore(round, player.id, session.categories),
	};
};

/**
 * The first player, in seat order, to reach the target score — the subject of
 * the advisory line above the entry bar.
 *
 * **Naming them changes nothing.** Passing a target is a fact about the game;
 * the table decides when it is over, so this never ends a session.
 */
export const passer = (session: Standable) => {
	const { targetScore } = session;
	if (targetScore === undefined) return undefined;

	return session.players.find(
		(player) =>
			playerTotal(session.rounds, player.id, session.categories) >= targetScore,
	);
};

/**
 * The tally standings: every player, **in seat order**, carrying the rank
 * `ranking` gave them. Rank is a number in the margin — the person you are
 * looking for is where they were last hand. Sorting happens once, on Results.
 */
export const standings = (session: Standable): StandingsRow[] => {
	const seats = new Map(
		session.players.map((player, seat) => [player.id, seat]),
	);
	const taken = session.rounds.map((round) => handTakers(session, round));
	const lastRound = session.rounds[session.rounds.length - 1];

	return ranking(session)
		.map((ranked) => {
			const seat = seats.get(ranked.player.id) ?? 0;

			return {
				...ranked,
				toGo: toGo(ranked.total, session.targetScore),
				racebar: racebarFraction(ranked.total, session.targetScore),
				handsWon: taken.filter((hand) => hand[seat]).length,
				lastHand:
					lastRound === undefined
						? undefined
						: roundScore(lastRound, ranked.player.id, session.categories),
			};
		})
		.sort((a, b) => a.player.sortOrder - b.player.sortOrder);
};
