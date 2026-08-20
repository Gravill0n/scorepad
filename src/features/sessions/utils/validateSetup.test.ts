import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import type { SetupRow } from "./setupRows";
import { validateSetup } from "./validateSetup";

const find = (id: string): Template => {
	const template = templates.find((candidate) => candidate.id === id);
	if (!template) throw new Error(`no template "${id}"`);
	return template;
};

const rowsFrom = (...names: string[]): SetupRow[] =>
	names.map((name, index) => ({
		id: `r${index}`,
		name,
		colorIndex: index + 1,
	}));

describe("setup validation", () => {
	it("passes a table that is inside the range and uniquely named", () => {
		expect(
			validateSetup(rowsFrom("Marie", "Luc"), find("wingspan")),
		).toBeNull();
	});

	it("blocks a table below the template's minimum", () => {
		expect(validateSetup(rowsFrom("Nous"), find("belote"))).toBe("too-few");
	});

	it("blocks a table above the template's maximum", () => {
		const eleven = rowsFrom(...Array.from({ length: 11 }, (_, i) => `P${i}`));
		expect(validateSetup(eleven, find("uno"))).toBe("too-many");
	});

	it("blocks an unnamed row, whitespace included", () => {
		expect(validateSetup(rowsFrom("Marie", "   "), find("wingspan"))).toBe(
			"empty-name",
		);
	});

	it("blocks two teams that share a name — the case 1i is drawn on", () => {
		expect(
			validateSetup(rowsFrom("Marie & Luc", "Marie & Luc"), find("belote")),
		).toBe("duplicate-name");
	});

	it("treats a difference of case or padding as the same name", () => {
		expect(validateSetup(rowsFrom("Marie", " marie "), find("wingspan"))).toBe(
			"duplicate-name",
		);
	});

	it("reports the count problem before the name problem", () => {
		// One reason at a time, and the one that is furthest from playable.
		expect(validateSetup(rowsFrom(""), find("belote"))).toBe("too-few");
	});
});
