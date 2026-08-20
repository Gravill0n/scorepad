import { relativeTime } from "./relativeTime";

const NOW = new Date("2026-04-12T20:00:00.000Z");
const ago = (seconds: number) =>
	new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("relativeTime", () => {
	it("reads 20 min ago, as the artboard stamps it", () => {
		expect(relativeTime(ago(20 * 60), NOW)).toBe("20 min ago");
	});

	it("reads 4 days ago", () => {
		expect(relativeTime(ago(4 * 86_400), NOW)).toBe("4 days ago");
	});

	it("reads never when there is no timestamp", () => {
		expect(relativeTime(null, NOW)).toBe("Never");
		expect(relativeTime(undefined, NOW)).toBe("Never");
	});

	it("reads never rather than crashing on a corrupted timestamp", () => {
		expect(relativeTime("not a date", NOW)).toBe("Never");
	});

	it("says just now under a minute, rather than 0 min ago", () => {
		expect(relativeTime(ago(5), NOW)).toBe("Just now");
		expect(relativeTime(ago(59), NOW)).toBe("Just now");
	});

	it("switches unit at each boundary", () => {
		expect(relativeTime(ago(60), NOW)).toBe("1 min ago");
		expect(relativeTime(ago(3_600), NOW)).toBe("1 hr ago");
		expect(relativeTime(ago(86_400), NOW)).toBe("1 day ago");
		expect(relativeTime(ago(2_592_000), NOW)).toBe("1 mo ago");
		expect(relativeTime(ago(31_536_000), NOW)).toBe("1 yr ago");
	});

	it("localises to French without a table of abbreviations", () => {
		// The gap before the unit is U+00A0, not a space. That is correct French
		// typography and it stops "20" wrapping away from "min" in a narrow row,
		// so it is preserved rather than normalised away.
		expect(relativeTime(ago(20 * 60), NOW, "fr")).toBe("il y a 20\u00a0min");
		expect(relativeTime(ago(4 * 86_400), NOW, "fr")).toBe("il y a 4\u00a0j");
	});

	it("handles a timestamp from the future without going backwards", () => {
		const future = new Date(NOW.getTime() + 20 * 60 * 1000).toISOString();
		expect(relativeTime(future, NOW)).toBe("in 20 min");
	});
});
