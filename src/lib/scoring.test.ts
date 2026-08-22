import { readFileSync } from "node:fs";
import type { Player, Round } from "@/types/session";
import type { Category } from "@/types/template";
import { cellScore, playerTotal, ranking, roundScore } from "./scoring";

const player = (id: string, sortOrder: number): Player => ({
	id,
	name: id,
	colorIndex: sortOrder + 1,
	sortOrder,
});

describe("cellScore", () => {
	it("returns the raw value when no multiplier or divisor is set", () => {
		expect(cellScore(7, { key: "birds", label: "Birds" })).toBe(7);
	});

	it("applies an integer multiplier", () => {
		expect(
			cellScore(3, { key: "cities", label: "Cities", multiplier: 2 }),
		).toBe(6);
	});

	it("applies a negative multiplier, which is the whole negative-category feature", () => {
		expect(
			cellScore(4, {
				key: "tickets_failed",
				label: "Uncompleted tickets",
				multiplier: -1,
			}),
		).toBe(-4);
	});

	it("floors division rather than rounding it", () => {
		const coins: Category = { key: "treasury", label: "Coins", divideBy: 3 };
		expect(cellScore(2, coins)).toBe(0);
		expect(cellScore(3, coins)).toBe(1);
		expect(cellScore(5, coins)).toBe(1);
	});

	it("floors toward negative infinity when the value is negative", () => {
		expect(
			cellScore(-5, { key: "penalty", label: "Penalty", divideBy: 3 }),
		).toBe(-2);
	});

	it("combines a multiplier and a divisor", () => {
		expect(
			cellScore(7, { key: "odd", label: "Odd", multiplier: 2, divideBy: 3 }),
		).toBe(4);
	});

	it("scores zero as zero", () => {
		expect(
			cellScore(0, { key: "cities", label: "Cities", multiplier: 2 }),
		).toBe(0);
	});
});

// The regression this whole module exists to prevent. An early draft used
// multiplier 0.3333 for 7 Wonders coins; it is wrong at the very first case
// (3 coins scored 0 instead of 1). Never delete this test.
describe("cellScore with divideBy: 3 — the 7 Wonders coins regression", () => {
	const coins: Category = { key: "treasury", label: "Coins", divideBy: 3 };

	it("equals Math.floor(n / 3) for every n from 0 to 10000", () => {
		for (let n = 0; n <= 10000; n++) {
			expect(cellScore(n, coins)).toBe(Math.floor(n / 3));
		}
	});

	it("scores 3 coins as 1 point, which a fractional multiplier gets wrong", () => {
		expect(cellScore(3, coins)).toBe(1);
		expect(Math.floor(3 * 0.3333)).toBe(0);
	});
});

describe("roundScore", () => {
	const categories: Category[] = [
		{ key: "board", label: "Board" },
		{ key: "rows", label: "Rows", multiplier: 2 },
	];

	it("sums every category in the round", () => {
		const round: Round = { marie: { board: 10, rows: 3 } };
		expect(roundScore(round, "marie", categories)).toBe(16);
	});

	it("reads a missing category entry as zero", () => {
		const round: Round = { marie: { board: 10 } };
		expect(roundScore(round, "marie", categories)).toBe(10);
	});

	it("reads a player absent from the round as zero", () => {
		expect(roundScore({}, "marie", categories)).toBe(0);
	});

	it("reads a non-numeric entry as zero rather than letting NaN propagate", () => {
		const round = { marie: { board: Number.NaN, rows: 3 } } as unknown as Round;
		expect(roundScore(round, "marie", categories)).toBe(6);
	});

	it("ignores a category the round holds but the session does not", () => {
		const round: Round = { marie: { board: 10, dropped_category: 999 } };
		expect(roundScore(round, "marie", categories)).toBe(10);
	});
});

describe("playerTotal", () => {
	const categories: Category[] = [{ key: "points", label: "Points" }];

	it("accumulates across every round", () => {
		const rounds: Round[] = [
			{ marie: { points: 40 } },
			{ marie: { points: 25 } },
			{ marie: { points: 60 } },
		];
		expect(playerTotal(rounds, "marie", categories)).toBe(125);
	});

	it("treats a freshly appended empty round as contributing zero", () => {
		const rounds: Round[] = [{ marie: { points: 40 } }, {}];
		expect(playerTotal(rounds, "marie", categories)).toBe(40);
	});

	it("totals zero for a player who has entered nothing", () => {
		expect(playerTotal([{ luc: { points: 40 } }], "marie", categories)).toBe(0);
	});

	it("totals zero when there are no rounds at all", () => {
		expect(playerTotal([], "marie", categories)).toBe(0);
	});
});

describe("ranking", () => {
	const categories: Category[] = [{ key: "points", label: "Points" }];
	const marie = player("marie", 0);
	const luc = player("luc", 1);
	const sofia = player("sofia", 2);

	it("orders highest total first when win is highest", () => {
		const result = ranking({
			players: [marie, luc, sofia],
			rounds: [
				{ marie: { points: 10 }, luc: { points: 30 }, sofia: { points: 20 } },
			],
			categories,
			win: "highest",
		});
		expect(result.map((r) => r.player.id)).toEqual(["luc", "sofia", "marie"]);
		expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
	});

	it("orders lowest total first when win is lowest", () => {
		const result = ranking({
			players: [marie, luc, sofia],
			rounds: [
				{ marie: { points: 10 }, luc: { points: 30 }, sofia: { points: 20 } },
			],
			categories,
			win: "lowest",
		});
		expect(result.map((r) => r.player.id)).toEqual(["marie", "sofia", "luc"]);
	});

	it("gives tied players the same rank and marks them tied", () => {
		const result = ranking({
			players: [marie, luc, sofia],
			rounds: [
				{ marie: { points: 30 }, luc: { points: 30 }, sofia: { points: 10 } },
			],
			categories,
			win: "highest",
		});
		expect(result.map((r) => r.rank)).toEqual([1, 1, 3]);
		expect(result.map((r) => r.tied)).toEqual([true, true, false]);
	});

	it("skips the ranks a tie consumes, so two firsts are followed by third", () => {
		const result = ranking({
			players: [marie, luc, sofia],
			rounds: [
				{ marie: { points: 30 }, luc: { points: 30 }, sofia: { points: 10 } },
			],
			categories,
			win: "highest",
		});
		expect(result[2]?.rank).toBe(3);
	});

	it("breaks a tie's display order by seat order, never by name", () => {
		const result = ranking({
			players: [sofia, marie, luc],
			rounds: [
				{ marie: { points: 30 }, luc: { points: 30 }, sofia: { points: 30 } },
			],
			categories,
			win: "highest",
		});
		expect(result.map((r) => r.player.id)).toEqual(["marie", "luc", "sofia"]);
	});

	it("ranks everyone equal first when all totals are zero", () => {
		const result = ranking({
			players: [marie, luc, sofia],
			rounds: [{}],
			categories,
			win: "highest",
		});
		expect(result.map((r) => r.rank)).toEqual([1, 1, 1]);
		expect(result.every((r) => r.tied)).toBe(true);
	});

	it("ranks a player with no entries last rather than leaving them unranked", () => {
		const result = ranking({
			players: [marie, luc],
			rounds: [{ luc: { points: 30 } }],
			categories,
			win: "highest",
		});
		expect(result).toHaveLength(2);
		expect(result[1]).toMatchObject({ rank: 2, total: 0, tied: false });
		expect(result[1]?.player.id).toBe("marie");
	});

	it("ranks a zero-scoring player first when win is lowest", () => {
		const result = ranking({
			players: [marie, luc],
			rounds: [{ luc: { points: 30 } }],
			categories,
			win: "lowest",
		});
		expect(result[0]?.player.id).toBe("marie");
	});

	it("never produces rank 0, even for a corrupted entry", () => {
		const rounds = [
			{ marie: { points: Number.NaN }, luc: { points: 10 } },
		] as unknown as Round[];
		const result = ranking({
			players: [marie, luc],
			rounds,
			categories,
			win: "highest",
		});
		expect(result.every((r) => r.rank >= 1)).toBe(true);
		expect(result.every((r) => Number.isFinite(r.total))).toBe(true);
	});

	it("returns an empty list for a session with no players", () => {
		expect(
			ranking({ players: [], rounds: [], categories, win: "highest" }),
		).toEqual([]);
	});

	it("does not reorder the caller's players array", () => {
		const players = [marie, luc, sofia];
		ranking({
			players,
			rounds: [{ marie: { points: 10 }, luc: { points: 30 } }],
			categories,
			win: "highest",
		});
		expect(players.map((p) => p.id)).toEqual(["marie", "luc", "sofia"]);
	});
});

// CLAUDE.md: "lib/scoring.ts imports no React, no DB, no features/." Nothing
// enforces that but review, so enforce it here instead.
describe("module boundaries", () => {
	it("imports nothing but types", () => {
		const source = readFileSync("src/lib/scoring.ts", "utf8");
		const imports = source.match(/^import .*$/gm) ?? [];
		expect(imports.every((line) => line.startsWith("import type "))).toBe(true);
	});
});
