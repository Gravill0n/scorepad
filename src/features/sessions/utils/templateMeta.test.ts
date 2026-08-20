import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import { templateMeta } from "./templateMeta";

const find = (id: string): Template => {
	const template = templates.find((candidate) => candidate.id === id);
	if (!template) throw new Error(`no template "${id}"`);
	return template;
};

describe("the shelf's meta line", () => {
	it("counts categories and the player range for a sheet game", () => {
		expect(templateMeta(find("wingspan"))).toBe("6 categories · 1–5");
	});

	it("names the target and the player range for a tally game", () => {
		expect(templateMeta(find("uno"))).toBe("to 500 · 2–10");
	});

	it("says teams rather than 2–2 when a row is not a person", () => {
		expect(templateMeta(find("belote"))).toBe("to 501 · 2 teams");
	});

	it("drops the target clause when a template has none", () => {
		expect(templateMeta(find("counter"))).toBe("1–12");
	});

	it("is derived, so every registered template has one", () => {
		for (const template of templates) {
			expect(templateMeta(template).length).toBeGreaterThan(0);
		}
	});
});
