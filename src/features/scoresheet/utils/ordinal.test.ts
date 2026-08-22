import { ordinal } from "./ordinal";

describe("rank labels", () => {
	it("reads English ordinals the way English does", () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((n) => ordinal(n))).toEqual([
			"1st",
			"2nd",
			"3rd",
			"4th",
			"11th",
			"12th",
			"13th",
			"21st",
			"22nd",
		]);
	});

	it("reads French ordinals the way French does", () => {
		expect([1, 2, 3, 11].map((n) => ordinal(n, "fr"))).toEqual([
			"1er",
			"2e",
			"3e",
			"11e",
		]);
	});

	it("covers every rank a legal table can produce", () => {
		for (let rank = 1; rank <= 12; rank += 1) {
			expect(ordinal(rank)).toMatch(/^\d+(st|nd|rd|th)$/);
			expect(ordinal(rank, "fr")).toMatch(/^\d+(er|e)$/);
		}
	});
});
