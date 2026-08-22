import type { Session } from "@/types/session";
import { emptyCells, takeaway } from "./results";

const players = ["marie", "luc", "sofia"].map((id, index) => ({
	id,
	name: id,
	colorIndex: index + 1,
	sortOrder: index,
}));

const sheet = (rounds: Session["rounds"]) => ({
	mode: "sheet" as const,
	players,
	categories: [
		{ key: "birds", label: "Birds" },
		{ key: "eggs", label: "Eggs" },
		{ key: "food", label: "Food" },
	],
	win: "highest" as const,
	rounds,
});

const tally = (rounds: Session["rounds"]) => ({
	mode: "tally" as const,
	players,
	categories: [{ key: "points", label: "Points" }],
	win: "highest" as const,
	rounds,
});

describe("takeaway", () => {
	it("names who took the most categories on a sheet", () => {
		expect(
			takeaway(
				sheet([
					{
						marie: { birds: 30, eggs: 2, food: 1 },
						luc: { birds: 10, eggs: 9, food: 0 },
						sofia: { birds: 5, eggs: 1, food: 8 },
					},
				]),
			),
		).toEqual({ total: 3, name: "marie", count: 1 });
	});

	it("names who took the most hands in a tally", () => {
		expect(
			takeaway(
				tally([
					{ marie: { points: 60 }, luc: { points: 0 } },
					{ marie: { points: 0 }, luc: { points: 44 } },
					{ marie: { points: 12 }, luc: { points: 0 } },
				]),
			),
		).toEqual({ total: 3, name: "marie", count: 2 });
	});

	it("counts the lowest scorer as the taker when lowest wins", () => {
		expect(
			takeaway({
				...tally([
					{ marie: { points: 26 }, luc: { points: 0 }, sofia: { points: 13 } },
				]),
				win: "lowest" as const,
			}),
		).toEqual({ total: 1, name: "luc", count: 1 });
	});

	it("breaks a count tie on seat order, since the line holds one name", () => {
		// Marie and Luc take one category each; Marie sits first.
		expect(
			takeaway(
				sheet([{ marie: { birds: 30, eggs: 0 }, luc: { birds: 0, eggs: 30 } }]),
			)?.name,
		).toBe("marie");
	});

	it("is undefined for a game with nothing entered — there is no takeaway", () => {
		expect(takeaway(tally([]))).toBeUndefined();
		expect(takeaway(sheet([{}]))).toBeUndefined();
	});
});

describe("emptyCells", () => {
	it("counts the cells nobody filled on a sheet", () => {
		// 3 players × 3 categories = 9; four were entered.
		expect(
			emptyCells(
				sheet([
					{
						marie: { birds: 3, eggs: 1 },
						luc: { birds: 2 },
						sofia: { food: 4 },
					},
				]),
			),
		).toBe(5);
	});

	it("counts a player missing from a hand in a tally", () => {
		expect(
			emptyCells(tally([{ marie: { points: 60 }, luc: { points: 0 } }])),
		).toBe(1);
	});

	it("is zero when every cell was entered", () => {
		expect(
			emptyCells(
				tally([
					{ marie: { points: 1 }, luc: { points: 2 }, sofia: { points: 3 } },
				]),
			),
		).toBe(0);
	});

	it("counts a typed zero as entered, because it is", () => {
		expect(
			emptyCells(
				sheet([
					{
						marie: { birds: 0, eggs: 0, food: 0 },
						luc: { birds: 0, eggs: 0, food: 0 },
						sofia: { birds: 0, eggs: 0, food: 0 },
					},
				]),
			),
		).toBe(0);
	});

	it("is zero for a tally with no hands, rather than counting phantom cells", () => {
		expect(emptyCells(tally([]))).toBe(0);
	});
});
