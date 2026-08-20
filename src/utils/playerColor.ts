/** The palette is twelve indices wide (`tokens.css`), and it never grows. */
export const PALETTE_SIZE = 12;

/**
 * A player colour is an **index**, never a hex in the database. This is the
 * one place the index becomes a colour, so a stored `colorIndex` and the token
 * it paints cannot drift apart.
 */
export const playerColor = (index: number): string =>
	`var(--player-${String(index).padStart(2, "0")})`;

/**
 * The initial that rides on every token. Colour is never the only difference
 * between two players — twelve pure hues do not survive colourblind viewing.
 *
 * Taken from the first grapheme rather than the first code unit, so "Émile"
 * gives "É" and an emoji name gives the emoji rather than half of it.
 */
export const playerInitial = (name: string): string => {
	const trimmed = name.trim();
	if (trimmed === "") return "?";
	const [first = trimmed[0] ?? "?"] = Array.from(trimmed);
	return first.toLocaleUpperCase();
};

/**
 * Colours are handed out in palette order as players are added: the first six
 * stay pairwise distinct under protan, deutan and tritan, so the front of the
 * palette is where a four-player table lands.
 */
export const nextColorIndex = (taken: number[]): number => {
	const used = new Set(taken);
	for (let index = 1; index <= PALETTE_SIZE; index += 1) {
		if (!used.has(index)) return index;
	}
	// Thirteen players cannot happen: no template allows more than twelve.
	return PALETTE_SIZE;
};
