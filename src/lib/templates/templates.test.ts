import { readdirSync, readFileSync } from "node:fs";
import { playerTotal } from "@/lib/scoring";
import type { Round } from "@/types/session";
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
	{ entries: Record<string, number>; total: number }
> = {
	catan: {
		// 3 + (2x2) + (1x2) + 0 + 1 = 10, a winning score
		entries: {
			settlements: 3,
			cities: 2,
			longest_road: 1,
			largest_army: 0,
			vp_cards: 1,
		},
		total: 10,
	},
	splendor: {
		// 12 + (1x3) = 15
		entries: { cards: 12, nobles: 1 },
		total: 15,
	},
	wingspan: {
		// 25 + 8 + 12 + 14 + 6 + 5 = 70, every category weighted 1
		entries: { birds: 25, bonus: 8, goals: 12, eggs: 14, food: 6, tucked: 5 },
		total: 70,
	},
	azul: {
		// 42 + (2x2) + (1x7) + (1x10) = 63
		entries: { board: 42, rows: 2, columns: 1, colors: 1 },
		total: 63,
	},
	"ticket-to-ride": {
		// 68 + 17 - 5 + (1x10) = 90; the failed tickets are entered positive
		entries: {
			routes: 68,
			tickets_complete: 17,
			tickets_failed: 5,
			longest_path: 1,
		},
		total: 90,
	},
	"7-wonders": {
		// 5 + floor(8/3) + 6 + 14 + 13 + 4 + 7 = 51. Eight coins is 2 points,
		// which is the case a fractional multiplier gets wrong.
		entries: {
			military: 5,
			treasury: 8,
			wonders: 6,
			civilian: 14,
			science: 13,
			commercial: 4,
			guilds: 7,
		},
		total: 51,
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
		const rounds: Round[] = [{ p1: fixture.entries }];
		expect(playerTotal(rounds, "p1", template.categories)).toBe(fixture.total);
	});

	it("enters a value for every category, so no category is left unexercised", () => {
		const fixture = FIXTURES[id];
		if (!fixture) throw new Error(`no fixture for ${id}`);
		expect(Object.keys(fixture.entries).sort()).toEqual(
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
