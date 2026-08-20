import { readdirSync, readFileSync } from "node:fs";
import { playerTotal, ranking } from "@/lib/scoring";
import type { Player, Round } from "@/types/session";
import { templates } from "./registry";
import { validateTemplate } from "./validate";

const TEMPLATE_DIR = "src/lib/templates";

/**
 * One hand-checked fixture per template: raw entries as a player would type
 * them, and the total worked out by hand from the multipliers in the grammar.
 * A registered template without a fixture fails this suite on purpose.
 */
const FIXTURES: Record<
	string,
	{ rounds: Record<string, number>[]; total: number }
> = {
	catan: {
		// 3 + (2x2) + (1x2) + 0 + 1 = 10, a winning score
		rounds: [
			{
				settlements: 3,
				cities: 2,
				longest_road: 1,
				largest_army: 0,
				vp_cards: 1,
			},
		],
		total: 10,
	},
	splendor: {
		// 12 + (1x3) = 15
		rounds: [{ cards: 12, nobles: 1 }],
		total: 15,
	},
	wingspan: {
		// 25 + 8 + 12 + 14 + 6 + 5 = 70, every category weighted 1
		rounds: [{ birds: 25, bonus: 8, goals: 12, eggs: 14, food: 6, tucked: 5 }],
		total: 70,
	},
	azul: {
		// 42 + (2x2) + (1x7) + (1x10) = 63
		rounds: [{ board: 42, rows: 2, columns: 1, colors: 1 }],
		total: 63,
	},
	"ticket-to-ride": {
		// 68 + 17 - 5 + (1x10) = 90; the failed tickets are entered positive
		rounds: [
			{
				routes: 68,
				tickets_complete: 17,
				tickets_failed: 5,
				longest_path: 1,
			},
		],
		total: 90,
	},
	"7-wonders": {
		// 5 + floor(8/3) + 6 + 14 + 13 + 4 + 7 = 51. Eight coins is 2 points,
		// which is the case a fractional multiplier gets wrong.
		rounds: [
			{
				military: 5,
				treasury: 8,
				wonders: 6,
				civilian: 14,
				science: 13,
				commercial: 4,
				guilds: 7,
			},
		],
		total: 51,
	},
	uno: {
		// Three hands banked: 40 + 25 + 60 = 125, short of the 500 target.
		rounds: [{ points: 40 }, { points: 25 }, { points: 60 }],
		total: 125,
	},
	belote: {
		// Five hands to exactly 501 — the target, reached the way a real
		// evening reaches it. This is criterion 2's multi-round fixture.
		rounds: [
			{ hand: 82 },
			{ hand: 105 },
			{ hand: 91 },
			{ hand: 143 },
			{ hand: 80 },
		],
		total: 501,
	},
	whist: {
		// Three hands of tricks above six: 2 + 1 + 2 = 5, the target.
		rounds: [{ tricks: 2 }, { tricks: 1 }, { tricks: 2 }],
		total: 5,
	},
	"black-lady": {
		// Two hands of penalties: 13 + 4 = 17. Lowest wins, so this is a good
		// score, not a bad one.
		rounds: [{ penalty: 13 }, { penalty: 4 }],
		total: 17,
	},
	counter: {
		// A counter takes negatives: 5 - 2 + 10 = 13.
		rounds: [{ points: 5 }, { points: -2 }, { points: 10 }],
		total: 13,
	},
};

const jsonFiles = readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".json"));

describe("the template registry", () => {
	it("registers every JSON file in the template directory", () => {
		const registered = templates.map((t) => `${t.id}.json`).sort();
		expect(registered).toEqual([...jsonFiles].sort());
	});

	it("registers each template exactly once", () => {
		const ids = templates.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe.each(
	templates.map((t) => [t.id, t] as const),
)("%s", (id, template) => {
	it("passes every validation rule against its own filename", () => {
		expect(validateTemplate(template, id)).toEqual([]);
	});

	it("has a hand-checked scoring fixture", () => {
		expect(FIXTURES[id]).toBeDefined();
	});

	it("scores its fixture to the hand-checked total", () => {
		const fixture = FIXTURES[id];
		if (!fixture) throw new Error(`no fixture for ${id}`);
		const rounds: Round[] = fixture.rounds.map((entries) => ({ p1: entries }));
		expect(playerTotal(rounds, "p1", template.categories)).toBe(fixture.total);
	});

	it("enters a value for every category, so no category is left unexercised", () => {
		const fixture = FIXTURES[id];
		if (!fixture) throw new Error(`no fixture for ${id}`);
		const entered = fixture.rounds.flatMap((round) => Object.keys(round));
		expect([...new Set(entered)].sort()).toEqual(
			template.categories.map((c) => c.key).sort(),
		);
	});
});

describe("template files on disk", () => {
	it.each(jsonFiles)("%s contains no floating-point number", (file) => {
		const source = readFileSync(`${TEMPLATE_DIR}/${file}`, "utf8");
		const numbers = source.match(/-?\d+\.\d+/g);
		expect(numbers).toBeNull();
	});

	it.each(jsonFiles)("%s parses and its id matches its filename", (file) => {
		const parsed = JSON.parse(readFileSync(`${TEMPLATE_DIR}/${file}`, "utf8"));
		expect(parsed.id).toBe(file.replace(/\.json$/, ""));
	});
});

// Success criterion 2 names these two fixtures specifically. They are written
// out rather than generated, because they are the cases the generic loop above
// cannot express: accumulation across many hands, and a reversed win direction.

const seat = (id: string, sortOrder: number): Player => ({
	id,
	name: id,
	colorIndex: sortOrder + 1,
	sortOrder,
});

describe("criterion 2: a multi-round Belote fixture", () => {
	const belote = templates.find((t) => t.id === "belote");
	if (!belote) throw new Error("belote is not registered");

	// Two team entries over five hands. "Nous" reaches exactly 501.
	const rounds: Round[] = [
		{ nous: { hand: 82 }, eux: { hand: 78 } },
		{ nous: { hand: 105 }, eux: { hand: 55 } },
		{ nous: { hand: 91 }, eux: { hand: 69 } },
		{ nous: { hand: 143 }, eux: { hand: 17 } },
		{ nous: { hand: 80 }, eux: { hand: 80 } },
	];

	it("accumulates each team across all five hands", () => {
		expect(playerTotal(rounds, "nous", belote.categories)).toBe(501);
		expect(playerTotal(rounds, "eux", belote.categories)).toBe(299);
	});

	it("reaches the template's 501 target exactly", () => {
		expect(belote.targetScore).toBe(501);
		expect(playerTotal(rounds, "nous", belote.categories)).toBe(
			belote.targetScore,
		);
	});

	it("ranks the higher total first, because Belote is won highest", () => {
		const result = ranking({
			players: [seat("nous", 0), seat("eux", 1)],
			rounds,
			categories: belote.categories,
			win: belote.win,
		});
		expect(result.map((r) => r.player.id)).toEqual(["nous", "eux"]);
	});

	it("is a two-team template, labelled as such", () => {
		expect(belote.entry).toBe("team");
		expect(belote.players).toEqual([2, 2]);
	});
});

describe("criterion 2: a win: lowest Black Lady fixture", () => {
	const blackLady = templates.find((t) => t.id === "black-lady");
	if (!blackLady) throw new Error("black-lady is not registered");

	// Two balanced hands of 26 penalty points each.
	const rounds: Round[] = [
		{ marie: { penalty: 13 }, luc: { penalty: 8 }, sofia: { penalty: 5 } },
		{ marie: { penalty: 4 }, luc: { penalty: 20 }, sofia: { penalty: 2 } },
	];
	const players = [seat("marie", 0), seat("luc", 1), seat("sofia", 2)];

	it("accumulates penalties across hands", () => {
		expect(playerTotal(rounds, "marie", blackLady.categories)).toBe(17);
		expect(playerTotal(rounds, "luc", blackLady.categories)).toBe(28);
		expect(playerTotal(rounds, "sofia", blackLady.categories)).toBe(7);
	});

	it("ranks the lowest total first, which is the whole point of this template", () => {
		const result = ranking({
			players,
			rounds,
			categories: blackLady.categories,
			win: blackLady.win,
		});
		expect(blackLady.win).toBe("lowest");
		expect(result.map((r) => r.player.id)).toEqual(["sofia", "marie", "luc"]);
		expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
	});

	it("carries the handTotal each hand is expected to distribute", () => {
		expect(blackLady.handTotal).toBe(26);
		for (const round of rounds) {
			const dealt = Object.values(round).reduce((sum, e) => sum + e.penalty, 0);
			expect(dealt).toBe(blackLady.handTotal);
		}
	});

	it("still scores a hand that does not balance — shooting the moon is legal", () => {
		const moon: Round[] = [
			{ marie: { penalty: 26 }, luc: { penalty: 26 }, sofia: { penalty: 0 } },
		];
		expect(playerTotal(moon, "marie", blackLady.categories)).toBe(26);
		expect(playerTotal(moon, "sofia", blackLady.categories)).toBe(0);
	});
});
