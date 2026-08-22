/**
 * `2ND`, `2E` — the rank label in a sheet row's sub-line and on Results.
 *
 * Intl does the plural category; the suffixes are a two-locale table because
 * `Intl.PluralRules` reports "ordinal category two", not the letters. A tie is
 * marked with `=` by the caller: ranking resolves nothing.
 */
const SUFFIXES: Record<"en" | "fr", Record<Intl.LDMLPluralRule, string>> = {
	en: { one: "st", two: "nd", few: "rd", other: "th", zero: "th", many: "th" },
	// French ordinals are "1er" and then "e" all the way down.
	fr: { one: "er", two: "e", few: "e", other: "e", zero: "e", many: "e" },
};

export const ordinal = (rank: number, locale: "en" | "fr" = "en"): string => {
	const rule = new Intl.PluralRules(locale === "fr" ? "fr-FR" : "en-GB", {
		type: "ordinal",
	}).select(rank);

	return `${rank}${SUFFIXES[locale][rule]}`;
};
