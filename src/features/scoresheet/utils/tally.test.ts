import type { Session } from "@/types/session";
import type { Category } from "@/types/template";
import {
	density,
	handBalance,
	handPlaced,
	lastHandRecap,
	passer,
	racebarFraction,
	standings,
	toGo,
} from "./tally";

const points: Category[] = [{ key: "points", label: "Points" }];

const player = (id: string, sortOrder: number) => ({
	id,
	name: id,
	colorIndex: sortOrder + 1,
	sortOrder,
});

describe("density", () => {
	it("is roomy up to three players and comfortable at four", () => {
		expect(density(3)).toBe("roomy");
		expect(density(4)).toBe("comfortable");
	});

	it("is comfortable up to six players and compact at seven", () => {
		expect(density(6)).toBe("comfortable");
		expect(density(7)).toBe("compact");
	});

	it("stays compact at the twelve-player ceiling", () => {
		expect(density(12)).toBe("compact");
	});
});

describe("toGo", () => {
	it("counts the points left to the target", () => {
		expect(toGo(346, 501)).toBe(155);
	});

	it("goes negative once the target is passed, so a caller can tell", () => {
		expect(toGo(512, 501)).toBe(-11);
	});

	it("is undefined without a target — a counter has nowhere to go", () => {
		expect(toGo(346, undefined)).toBeUndefined();
	});
});

describe("racebarFraction", () => {
	it("is the share of the target reached", () => {
		expect(racebarFraction(250, 500)).toBeCloseTo(0.5);
	});

	it("clamps to one past the target rather than overflowing the bar", () => {
		expect(racebarFraction(620, 500)).toBe(1);
	});

	it("clamps to zero below it, so a negative total draws no bar", () => {
		expect(racebarFraction(-40, 500)).toBe(0);
	});

	it("is undefined without a target — there is no race to draw", () => {
		expect(racebarFraction(250, undefined)).toBeUndefined();
	});
});

describe("handBalance", () => {
	const round = { marie: { points: 20 }, luc: { points: 6 } };

	it("is zero when the hand distributes exactly the fixed total", () => {
		expect(handBalance(round, points, 26)).toBe(0);
	});

	it("is negative while points are still unplaced", () => {
		expect(handBalance({ marie: { points: 20 } }, points, 26)).toBe(-6);
	});

	it("is positive when the moon is shot — and still just a number", () => {
		const moon = { marie: { points: 26 }, luc: { points: 26 } };
		expect(handBalance(moon, points, 26)).toBe(26);
	});

	it("counts an empty hand as nothing placed, never NaN", () => {
		expect(handBalance({}, points, 26)).toBe(-26);
	});

	it("reports what the table has placed, separately from the verdict", () => {
		expect(handPlaced(round, points)).toBe(26);
		expect(handPlaced({}, points)).toBe(0);
	});

	it("scores each cell before summing, so a multiplier is respected", () => {
		const tricks: Category[] = [
			{ key: "tricks", label: "Tricks", multiplier: 10 },
		];
		expect(handBalance({ marie: { tricks: 3 } }, tricks, 130)).toBe(-100);
	});
});

const belote = (
	rounds: Session["rounds"],
): Parameters<typeof standings>[0] => ({
	players: [player("marie", 0), player("luc", 1), player("sofia", 2)],
	rounds,
	categories: points,
	win: "highest",
	targetScore: 501,
});

describe("standings", () => {
	it("keeps seat order — rank is a number in the margin, never a sort", () => {
		const rows = standings(
			belote([
				{ marie: { points: 10 }, luc: { points: 90 }, sofia: { points: 50 } },
			]),
		);

		expect(rows.map((row) => row.player.id)).toEqual(["marie", "luc", "sofia"]);
		expect(rows.map((row) => row.rank)).toEqual([3, 1, 2]);
	});

	it("gives tied players the same rank and marks both", () => {
		const rows = standings(
			belote([
				{ marie: { points: 90 }, luc: { points: 90 }, sofia: { points: 10 } },
			]),
		);

		expect(rows.map((row) => row.rank)).toEqual([1, 1, 3]);
		expect(rows.map((row) => row.tied)).toEqual([true, true, false]);
	});

	it("ranks the lowest total first when the template says lowest wins", () => {
		const rows = standings({
			...belote([
				{ marie: { points: 90 }, luc: { points: 10 }, sofia: { points: 0 } },
			]),
			win: "lowest",
		});

		expect(rows.map((row) => row.rank)).toEqual([3, 2, 1]);
	});

	it("accumulates every hand into the total", () => {
		const rows = standings(
			belote([{ marie: { points: 80 } }, { marie: { points: 20 } }]),
		);

		expect(rows[0].total).toBe(100);
	});

	it("carries the race bar and the distance left for each row", () => {
		const rows = standings(belote([{ marie: { points: 346 } }]));

		expect(rows[0].toGo).toBe(155);
		expect(rows[0].racebar).toBeCloseTo(346 / 501);
	});

	it("carries neither without a target score", () => {
		const rows = standings({ ...belote([]), targetScore: undefined });

		expect(rows[0].toGo).toBeUndefined();
		expect(rows[0].racebar).toBeUndefined();
	});

	it("ranks a player with no entries last rather than leaving them out", () => {
		const rows = standings(belote([{ marie: { points: 10 } }]));

		expect(rows).toHaveLength(3);
		expect(rows.map((row) => row.total)).toEqual([10, 0, 0]);
		expect(rows.map((row) => row.rank)).toEqual([1, 2, 2]);
	});
});

describe("hands won", () => {
	const uno = (rounds: Session["rounds"]) => ({ ...belote(rounds), rounds });

	it("credits the highest scorer of each hand", () => {
		const rows = standings(
			uno([
				{ marie: { points: 60 }, luc: { points: 0 } },
				{ marie: { points: 0 }, luc: { points: 44 } },
				{ marie: { points: 12 }, luc: { points: 0 } },
			]),
		);

		expect(rows.map((row) => row.handsWon)).toEqual([2, 1, 0]);
	});

	it("credits the lowest scorer when the template says lowest wins", () => {
		const rows = standings({
			...belote([
				{ marie: { points: 26 }, luc: { points: 0 }, sofia: { points: 13 } },
			]),
			win: "lowest",
		});

		expect(rows.map((row) => row.handsWon)).toEqual([0, 1, 0]);
	});

	it("credits both players when a hand ties — a tie stays a tie", () => {
		const rows = standings(
			uno([
				{ marie: { points: 30 }, luc: { points: 30 }, sofia: { points: 5 } },
			]),
		);

		expect(rows.map((row) => row.handsWon)).toEqual([1, 1, 0]);
	});

	it("credits nobody for a hand with no entries at all", () => {
		const rows = standings(uno([{}]));

		expect(rows.map((row) => row.handsWon)).toEqual([0, 0, 0]);
	});
});

describe("the last hand", () => {
	it("carries each player's score in the hand just played", () => {
		const rows = standings(
			belote([
				{ marie: { points: 80 } },
				{ marie: { points: 20 }, luc: { points: 60 } },
			]),
		);

		expect(rows.map((row) => row.lastHand)).toEqual([20, 60, 0]);
	});

	it("is undefined before the first hand, which is not a zero", () => {
		const rows = standings(belote([]));

		expect(rows.map((row) => row.lastHand)).toEqual([
			undefined,
			undefined,
			undefined,
		]);
	});
});

describe("lastHandRecap", () => {
	it("names who took the hand and what it was worth", () => {
		expect(
			lastHandRecap(
				belote([
					{ marie: { points: 10 } },
					{ marie: { points: 5 }, luc: { points: 60 } },
				]),
			),
		).toEqual({ hand: 2, name: "luc", score: 60 });
	});

	it("names the lowest scorer when lowest wins", () => {
		expect(
			lastHandRecap({
				...belote([
					{ marie: { points: 26 }, luc: { points: 0 }, sofia: { points: 13 } },
				]),
				win: "lowest",
			}),
		).toEqual({ hand: 1, name: "luc", score: 0 });
	});

	it("is undefined before the first hand", () => {
		expect(lastHandRecap(belote([]))).toBeUndefined();
	});

	it("is undefined for a hand nobody has entered yet", () => {
		expect(lastHandRecap(belote([{}]))).toBeUndefined();
	});
});

describe("passer", () => {
	it("names the first player in seat order to reach the target", () => {
		expect(
			passer(belote([{ marie: { points: 40 }, luc: { points: 520 } }]))?.name,
		).toBe("luc");
	});

	it("is undefined while everyone is short of it", () => {
		expect(passer(belote([{ luc: { points: 500 } }]))).toBeUndefined();
	});

	it("is undefined for a template with no target at all", () => {
		expect(
			passer({
				...belote([{ luc: { points: 9000 } }]),
				targetScore: undefined,
			}),
		).toBeUndefined();
	});
});
