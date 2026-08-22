import { templates } from "@/lib/templates/registry";
import { categoryChips } from "./categoryChips";

describe("the category strip's chips", () => {
	it("takes the first three letters, uppercased", () => {
		expect(categoryChips(["Military", "Science"])).toEqual(["MIL", "SCI"]);
	});

	it("keeps accents rather than stripping them", () => {
		expect(categoryChips(["Éclairage"])).toEqual(["ÉCL"]);
	});

	it("takes what there is when a label is shorter than three letters", () => {
		expect(categoryChips(["Go"])).toEqual(["GO"]);
	});

	it("falls back to the index for BOTH sides of a collision", () => {
		// Neither is the authoritative one, so neither keeps the abbreviation.
		expect(categoryChips(["Cartes vertes", "Cartes bleues"])).toEqual([
			"1",
			"2",
		]);
	});

	it("leaves a non-colliding neighbour alone", () => {
		expect(
			categoryChips(["Cartes vertes", "Cartes bleues", "Oiseaux"]),
		).toEqual(["1", "2", "OIS"]);
	});

	it("separates Ticket to Ride's two ticket categories, which do not collide", () => {
		const ticket = templates.find(
			(template) => template.id === "ticket-to-ride",
		);
		const chips = categoryChips(
			(ticket?.categories ?? []).map((category) => category.label),
		);
		expect(new Set(chips).size).toBe(chips.length);
	});

	it("gives every seed template a strip with no repeats", () => {
		for (const template of templates) {
			const chips = categoryChips(
				template.categories.map((category) => category.label),
			);
			expect(new Set(chips).size).toBe(chips.length);
		}
	});
});
