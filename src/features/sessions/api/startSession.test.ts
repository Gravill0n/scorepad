import { RECENT_NAMES_CAP } from "@/lib/db";
import { mergeRecentNames, requestPersistence } from "./startSession";

describe("the recent-names list", () => {
	it("puts the players who just played at the front", () => {
		expect(mergeRecentNames(["Sofia", "Tom"], ["Marie", "Luc"])).toEqual([
			"Marie",
			"Luc",
			"Sofia",
			"Tom",
		]);
	});

	it("keeps one entry per name, ignoring case and padding", () => {
		expect(mergeRecentNames(["Marie"], [" marie ", "Luc"])).toEqual([
			"marie",
			"Luc",
		]);
	});

	it("drops empty names rather than storing a blank pill", () => {
		expect(mergeRecentNames([], ["Marie", "   ", ""])).toEqual(["Marie"]);
	});

	it("caps the list, so the pills stay a shortlist", () => {
		const many = Array.from({ length: 30 }, (_, i) => `P${i}`);
		expect(mergeRecentNames([], many)).toHaveLength(RECENT_NAMES_CAP);
	});
});

describe("asking for durable storage", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("asks once and logs the answer", async () => {
		const persist = vi.fn().mockResolvedValue(true);
		vi.stubGlobal("navigator", {
			storage: { persist, persisted: vi.fn().mockResolvedValue(false) },
		});

		await expect(requestPersistence()).resolves.toBe(true);
		expect(persist).toHaveBeenCalledTimes(1);
	});

	it("does not ask again once the browser has already granted it", async () => {
		const persist = vi.fn();
		vi.stubGlobal("navigator", {
			storage: { persist, persisted: vi.fn().mockResolvedValue(true) },
		});

		await expect(requestPersistence()).resolves.toBe(true);
		expect(persist).not.toHaveBeenCalled();
	});

	it("says nothing at all where the API does not exist", async () => {
		vi.stubGlobal("navigator", {});
		await expect(requestPersistence()).resolves.toBeUndefined();
	});
});
