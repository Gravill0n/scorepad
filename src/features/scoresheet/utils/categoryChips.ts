/**
 * The category strip's chip text (`1c`): the first three letters of the
 * *translated* label, uppercased.
 *
 * If two categories in a template collide, **both** fall back to their 1-based
 * index — one of them keeping the abbreviation would read as the authoritative
 * one. `1c`'s hand-picked `MIL TRS WND CIV SCI COM GLD` would cost a per-category
 * `abbr` field in the grammar, which is a permanent compatibility surface; the
 * full label sits directly beneath the strip at 28px. A template that reads
 * badly here is the trigger to ask for the field, not to invent it.
 */
export const categoryChips = (labels: string[]): string[] => {
	const abbreviated = labels.map((label) =>
		// By grapheme, so an accented label keeps its first three letters and an
		// emoji is not cut in half.
		Array.from(label.trim()).slice(0, 3).join("").toLocaleUpperCase(),
	);

	const seen = new Map<string, number>();
	for (const chip of abbreviated) {
		seen.set(chip, (seen.get(chip) ?? 0) + 1);
	}

	return abbreviated.map((chip, index) =>
		(seen.get(chip) ?? 0) > 1 ? String(index + 1) : chip,
	);
};
