import type { Session } from "@/types/session";
import { sessionProgress, sessionTotals, sessionWinners } from "./summary";

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Chez Marie",
	templateId: "belote",
	mode: "tally",
	categories: [{ key: "hand", label: "Hand points" }],
	win: "highest",
	targetScore: 501,
	players: [
		{ id: "p1", name: "Nous", colorIndex: 1, sortOrder: 0 },
		{ id: "p2", name: "Eux", colorIndex: 2, sortOrder: 1 },
	],
	rounds: [],
	status: "active",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T19:00:00.000Z",
	...overrides,
});

const sheet = (overrides: Partial<Session> = {}) =>
	session({
		templateId: "wingspan",
		mode: "sheet",
		win: "highest",
		categories: [
			{ key: "birds", label: "Birds" },
			{ key: "bonus", label: "Bonus cards" },
			{ key: "eggs", label: "Eggs" },
		],
		rounds: [{}],
		...overrides,
	});

describe("sessionProgress in tally mode", () => {
	it("points at the hand about to be played, matching the entry bar", () => {
		// 13 hands recorded means you are about to play hand 14, which is what
		// the standings screen's `Enter hand N →` also says.
		const rounds = Array.from({ length: 13 }, () => ({}));
		expect(sessionProgress(session({ rounds }))).toEqual({
			mode: "tally",
			hand: 14,
		});
	});

	it("starts a fresh session at hand 1", () => {
		expect(sessionProgress(session())).toEqual({ mode: "tally", hand: 1 });
	});
});

describe("sessionProgress in sheet mode", () => {
	it("points at the first category nobody has filled in", () => {
		const rounds = [{ p1: { birds: 25 }, p2: { birds: 18 } }];
		expect(sessionProgress(sheet({ rounds }))).toEqual({
			mode: "sheet",
			category: 2,
			total: 3,
		});
	});

	it("starts an untouched sheet at the first category", () => {
		expect(sessionProgress(sheet())).toEqual({
			mode: "sheet",
			category: 1,
			total: 3,
		});
	});

	it("counts a category as filled when any player has entered it", () => {
		const rounds = [{ p2: { birds: 18 } }];
		expect(sessionProgress(sheet({ rounds }))).toMatchObject({ category: 2 });
	});

	it("stays on the last category once every one is filled", () => {
		const rounds = [{ p1: { birds: 1, bonus: 2, eggs: 3 } }];
		expect(sessionProgress(sheet({ rounds }))).toEqual({
			mode: "sheet",
			category: 3,
			total: 3,
		});
	});

	it("skips a gap rather than reporting a later category as current", () => {
		// birds empty, bonus filled: the first thing still to do is birds.
		const rounds = [{ p1: { bonus: 2 } }];
		expect(sessionProgress(sheet({ rounds }))).toMatchObject({ category: 1 });
	});

	it("treats an explicit zero as filled, because 0 is a real score", () => {
		const rounds = [{ p1: { birds: 0 } }];
		expect(sessionProgress(sheet({ rounds }))).toMatchObject({ category: 2 });
	});
});

describe("sessionTotals", () => {
	it("returns one total per player in seat order, never sorted", () => {
		const rounds = [
			{ p1: { hand: 300 }, p2: { hand: 268 } },
			{ p1: { hand: 212 }, p2: { hand: 200 } },
		];
		expect(sessionTotals(session({ rounds }))).toEqual([512, 468]);
	});

	it("keeps seat order even when the second player leads", () => {
		const rounds = [{ p1: { hand: 100 }, p2: { hand: 400 } }];
		expect(sessionTotals(session({ rounds }))).toEqual([100, 400]);
	});

	it("gives a player who has entered nothing a zero, not a gap", () => {
		expect(sessionTotals(session({ rounds: [{ p1: { hand: 50 } }] }))).toEqual([
			50, 0,
		]);
	});
});

describe("sessionWinners", () => {
	it("names the highest total when the game is won highest", () => {
		const rounds = [{ p1: { hand: 512 }, p2: { hand: 468 } }];
		const winners = sessionWinners(session({ rounds }));
		expect(winners.map((p) => p.name)).toEqual(["Nous"]);
	});

	it("names the lowest total when the game is won lowest", () => {
		const rounds = [{ p1: { hand: 88 }, p2: { hand: 42 } }];
		const winners = sessionWinners(session({ rounds, win: "lowest" }));
		expect(winners.map((p) => p.name)).toEqual(["Eux"]);
	});

	it("names every tied player, because a tie stays a tie", () => {
		const rounds = [{ p1: { hand: 300 }, p2: { hand: 300 } }];
		const winners = sessionWinners(session({ rounds }));
		expect(winners.map((p) => p.name)).toEqual(["Nous", "Eux"]);
	});

	it("returns nobody for a session with no players", () => {
		expect(sessionWinners(session({ players: [] }))).toEqual([]);
	});
});
