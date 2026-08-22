import { readFileSync } from "node:fs";

/**
 * **Success criterion 11**, computed rather than eyeballed.
 *
 * Light and dark must both clear 4.5:1 for body text and for every player
 * token with its initial. Twelve hues in two themes is 24 pairs nobody was ever
 * going to check by hand, and the initial on a token is the one piece of text
 * in the app whose background is chosen by a *database column*.
 *
 * There is no browser here, so the colours are read out of `tokens.css` and
 * converted in the test. `oklch()` is the palette's own notation, so the
 * conversion is part of the check rather than an approximation of it.
 */
const tokens = readFileSync("src/tokens.css", "utf8");

/** The `:root` block is light; the `[data-theme="dark"]` block overrides it. */
const blockFor = (theme: "light" | "dark") => {
	if (theme === "light") {
		const start = tokens.indexOf("@theme");
		return tokens.slice(start, tokens.indexOf('[data-theme="dark"]'));
	}
	return tokens.slice(tokens.indexOf('[data-theme="dark"]'));
};

const tokenValue = (theme: "light" | "dark", name: string): string => {
	const block = blockFor(theme);
	const match = block.match(new RegExp(`${name}:\\s*([^;]+);`, "g"));
	if (!match) throw new Error(`${name} is not defined for ${theme}`);
	// The dark block redeclares; the last declaration is the effective one.
	const last = match[match.length - 1] ?? "";
	return (last.split(":").slice(1).join(":").replace(";", "") ?? "").trim();
};

/** sRGB channel to its linear-light value, which is what luminance needs. */
const linearise = (channel: number) =>
	channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const fromHex = (hex: string): [number, number, number] => {
	const n = Number.parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [
		number,
		number,
		number,
	];
};

/**
 * oklch → linear sRGB, by the Oklab matrices. Out-of-gamut components are
 * clamped; a browser gamut-maps instead, which lands somewhere inside the same
 * boundary, so a colour that clears 4.5 here clears it there.
 */
const fromOklch = (css: string): [number, number, number] => {
	const [L, C, H] = (css.match(/oklch\(([^)]+)\)/)?.[1] ?? "")
		.trim()
		.split(/\s+/)
		.map(Number) as [number, number, number];

	const hue = (H * Math.PI) / 180;
	const a = C * Math.cos(hue);
	const b = C * Math.sin(hue);

	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.089484178 * a - 1.291485548 * b) ** 3;

	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map((channel) => Math.min(1, Math.max(0, channel))) as [
		number,
		number,
		number,
	];
};

/** Relative luminance, per WCAG 2.1. */
const luminance = (css: string): number => {
	const [r, g, b] = css.startsWith("#")
		? fromHex(css).map(linearise)
		: // oklch converts straight to linear light; no gamma round trip.
			fromOklch(css);
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

const contrast = (a: string, b: string): number => {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

/**
 * The conversion above is the whole test — if it drifted, every assertion
 * below would pass on wrong numbers. These two are the fixed points: pure
 * black on pure white is exactly 21:1, and `#777` on white is the value that
 * sits a hair under the 4.5 threshold in every published table.
 */
describe("the measurement itself", () => {
	it("puts black on white at 21:1", () => {
		expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 2);
	});

	it("puts the borderline grey just under 4.5:1", () => {
		expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
	});
});

const THEMES = ["light", "dark"] as const;
const PLAYERS = Array.from(
	{ length: 12 },
	(_, i) => `--player-${String(i + 1).padStart(2, "0")}`,
);

describe.each(THEMES)("%s theme", (theme) => {
	const token = (name: string) => tokenValue(theme, name);

	it("clears 4.5:1 for body text on every ground it sits on", () => {
		for (const ground of [
			"--color-paper",
			"--color-paper-dim",
			"--color-card",
		]) {
			expect(
				contrast(token("--color-ink"), token(ground)),
			).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("clears it for the soft ink that carries meta and eyebrows", () => {
		for (const ground of [
			"--color-paper",
			"--color-paper-dim",
			"--color-card",
		]) {
			expect(
				contrast(token("--color-ink-soft"), token(ground)),
			).toBeGreaterThanOrEqual(4.5);
		}
	});

	it("clears it for the initial on all twelve player tokens", () => {
		const ink = token("--player-ink");
		const failures = PLAYERS.filter(
			(player) => contrast(ink, token(player)) < 4.5,
		).map((player) => `${player} ${contrast(ink, token(player)).toFixed(2)}:1`);

		expect(failures).toEqual([]);
	});

	/**
	 * Light's teal clears the threshold by 0.02. That is not a defect — it
	 * passes — but it means the light palette has no room left: a hue rotated a
	 * few degrees or a lightness nudged a hundredth puts the initial under 4.5
	 * on somebody's token. The number is recorded here so a future palette edit
	 * fails this test instead of shipping.
	 */
	it("has a recorded worst case, so a palette edit cannot creep under it", () => {
		const ink = token("--player-ink");
		const worst = Math.min(
			...PLAYERS.map((player) => contrast(ink, token(player))),
		);

		expect(worst).toBeGreaterThanOrEqual(4.5);
		expect(worst).toBeCloseTo(theme === "light" ? 4.52 : 6.42, 2);
	});

	it("clears it for both signal inks on their own grounds", () => {
		expect(
			contrast(token("--color-alarm-ink"), token("--color-alarm-bg")),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrast(token("--color-advisory-ink"), token("--color-advisory-bg")),
		).toBeGreaterThanOrEqual(4.5);
	});
});

describe("the accent primary", () => {
	/**
	 * `.btn-primary` puts **paper on accent in both themes** — and paper is a
	 * different colour in each, so the pair passes twice for different reasons.
	 * Light's accent is dark, so near-white paper reads on it; dark's accent is
	 * a light orange, so dark's near-black paper reads on it.
	 *
	 * It is emphatically *not* ink on accent in dark. Dark's ink is a light
	 * cream and lands at 2.08:1 on dark's accent — the assertion below records
	 * that, because the rule looks like a candidate for "simplification" every
	 * time somebody reads it and the simplification fails criterion 11.
	 */
	it("carries paper on accent in light", () => {
		expect(
			contrast(
				tokenValue("light", "--color-paper"),
				tokenValue("light", "--color-accent"),
			),
		).toBeGreaterThanOrEqual(4.5);
	});

	it("carries paper on accent in dark too, which is what .btn-primary pins", () => {
		expect(
			contrast(
				tokenValue("dark", "--color-paper"),
				tokenValue("dark", "--color-accent"),
			),
		).toBeGreaterThanOrEqual(4.5);
	});

	/**
	 * The dark rule spells the colour out as a literal instead of reusing the
	 * token, so this pins the two together: the base rule already sets
	 * `color: var(--color-paper)`, and under `[data-theme="dark"]` that var
	 * resolves to exactly this hex — which makes the override's `color:`
	 * redundant, and the `font-weight` beside it the only line doing work.
	 * Editing dark's paper without editing the rule would silently unpick that.
	 */
	it("keeps the literal in the dark rule equal to the token it duplicates", () => {
		const rule = tokens.match(
			/\[data-theme="dark"\]\s*\.btn-primary\s*\{([^}]*)\}/,
		)?.[1];

		expect(rule).toBeDefined();
		expect(rule).toContain(tokenValue("dark", "--color-paper"));
	});

	it("would fail with ink, which is the swap that looks tempting", () => {
		expect(
			contrast(
				tokenValue("dark", "--color-ink"),
				tokenValue("dark", "--color-accent"),
			),
		).toBeLessThan(4.5);
	});

	it("would fail if paper were not itself theme-specific", () => {
		// Light's paper on dark's accent: the pairing that breaks if somebody
		// hoists one literal out of the two themes into a single value.
		expect(
			contrast(
				tokenValue("light", "--color-paper"),
				tokenValue("dark", "--color-accent"),
			),
		).toBeLessThan(4.5);
	});
});
