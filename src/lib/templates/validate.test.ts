import { readFileSync } from "node:fs";
import type { Template } from "@/types/template";
import { validateTemplate } from "./validate";

/** A template that breaks no rule. Each test bends exactly one thing. */
const valid = (overrides: Partial<Template> = {}): Template => ({
	id: "catan",
	name: "Catan",
	players: [3, 6],
	mode: "sheet",
	win: "highest",
	categories: [{ key: "settlements", label: "Settlements" }],
	...overrides,
});

describe("validateTemplate", () => {
	it("reports no problems for a valid template", () => {
		expect(validateTemplate(valid(), "catan")).toEqual([]);
	});

	it("rejects an id that does not match the filename stem", () => {
		expect(validateTemplate(valid({ id: "settlers" }), "catan")).toHaveLength(
			1,
		);
	});

	it("accepts a hyphenated id when the stem matches it", () => {
		expect(
			validateTemplate(valid({ id: "ticket-to-ride" }), "ticket-to-ride"),
		).toEqual([]);
	});

	it("rejects an empty category list", () => {
		expect(validateTemplate(valid({ categories: [] }), "catan")).toHaveLength(
			1,
		);
	});

	it("rejects two categories sharing a key", () => {
		const categories = [
			{ key: "cities", label: "Cities" },
			{ key: "cities", label: "Cities again" },
		];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a minimum player count below one", () => {
		expect(validateTemplate(valid({ players: [0, 6] }), "catan")).toHaveLength(
			1,
		);
	});

	it("rejects a maximum player count below the minimum", () => {
		expect(validateTemplate(valid({ players: [6, 3] }), "catan")).toHaveLength(
			1,
		);
	});

	it("accepts a fixed player count, which is how two-team games are expressed", () => {
		expect(validateTemplate(valid({ players: [2, 2] }), "catan")).toEqual([]);
	});

	it("rejects a zero multiplier, which would silently void a category", () => {
		const categories = [{ key: "cities", label: "Cities", multiplier: 0 }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a fractional multiplier — division is never a fractional multiplier", () => {
		const categories = [{ key: "coins", label: "Coins", multiplier: 0.3333 }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("accepts a negative multiplier, which is the negative-category feature", () => {
		const categories = [{ key: "failed", label: "Failed", multiplier: -1 }];
		expect(validateTemplate(valid({ categories }), "catan")).toEqual([]);
	});

	it("rejects a zero divisor", () => {
		const categories = [{ key: "coins", label: "Coins", divideBy: 0 }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a negative divisor", () => {
		const categories = [{ key: "coins", label: "Coins", divideBy: -3 }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a fractional divisor", () => {
		const categories = [{ key: "coins", label: "Coins", divideBy: 1.5 }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a key with an uppercase letter", () => {
		const categories = [{ key: "Cities", label: "Cities" }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a key starting with a digit", () => {
		const categories = [{ key: "1st_place", label: "First" }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("rejects a key containing a hyphen", () => {
		const categories = [{ key: "longest-road", label: "Longest road" }];
		expect(validateTemplate(valid({ categories }), "catan")).toHaveLength(1);
	});

	it("accepts a key with digits and underscores after the first letter", () => {
		const categories = [{ key: "vp_cards2", label: "VP cards" }];
		expect(validateTemplate(valid({ categories }), "catan")).toEqual([]);
	});

	it("rejects a zero handTotal", () => {
		const template = valid({ mode: "tally", handTotal: 0 });
		expect(validateTemplate(template, "catan")).toHaveLength(1);
	});

	it("rejects a fractional handTotal", () => {
		const template = valid({ mode: "tally", handTotal: 26.5 });
		expect(validateTemplate(template, "catan")).toHaveLength(1);
	});

	it("rejects handTotal on a sheet template — a sheet has no hands to balance", () => {
		expect(validateTemplate(valid({ handTotal: 26 }), "catan")).toHaveLength(1);
	});

	it("accepts handTotal on a tally template", () => {
		const template = valid({ mode: "tally", handTotal: 26 });
		expect(validateTemplate(template, "catan")).toEqual([]);
	});

	it("rejects an entry value that is neither player nor team", () => {
		const template = valid({ entry: "solo" as Template["entry"] });
		expect(validateTemplate(template, "catan")).toHaveLength(1);
	});

	it("accepts entry: team", () => {
		expect(validateTemplate(valid({ entry: "team" }), "catan")).toEqual([]);
	});

	it("rejects a win direction that is neither highest nor lowest", () => {
		const template = valid({ win: "Highest" as Template["win"] });
		expect(validateTemplate(template, "catan")).toHaveLength(1);
	});

	it("rejects a mode that is neither sheet nor tally", () => {
		const template = valid({ mode: "banana" as Template["mode"] });
		expect(validateTemplate(template, "catan")).toHaveLength(1);
	});

	it("rejects a players array with only one entry", () => {
		const players = [3] as unknown as Template["players"];
		expect(validateTemplate(valid({ players }), "catan")).toHaveLength(1);
	});

	it("rejects an empty players array", () => {
		const players = [] as unknown as Template["players"];
		expect(validateTemplate(valid({ players }), "catan")).toHaveLength(1);
	});

	it("rejects a fractional player count", () => {
		expect(
			validateTemplate(valid({ players: [2.5, 4] }), "catan"),
		).toHaveLength(1);
	});

	it("reports every problem at once rather than stopping at the first", () => {
		const broken = valid({
			id: "wrong",
			players: [0, 6],
			categories: [{ key: "Bad", label: "Bad", multiplier: 0 }],
		});
		expect(validateTemplate(broken, "catan").length).toBeGreaterThanOrEqual(4);
	});

	it("names the offending category so a failure is actionable", () => {
		const categories = [{ key: "coins", label: "Coins", divideBy: 0 }];
		expect(validateTemplate(valid({ categories }), "catan")[0]).toContain(
			"coins",
		);
	});
});

// CLAUDE.md: "lib/templates/validate.ts imports no React, no DB, no features/."
describe("module boundaries", () => {
	it("imports nothing but types", () => {
		const source = readFileSync("src/lib/templates/validate.ts", "utf8");
		const imports = source.match(/^import .*$/gm) ?? [];
		expect(imports.every((line) => line.startsWith("import type "))).toBe(true);
	});
});
