/** A template is data, never code. One generic renderer draws any template. */
export type Template = {
	/** Stable slug; the filename stem must match. */
	id: string;
	/** Display name, not translated (proper noun). */
	name: string;
	/** [min, max] inclusive. */
	players: [number, number];
	mode: "sheet" | "tally";
	/** 1..n, order is entry order. */
	categories: Category[];
	win: "highest" | "lowest";
	/** Game-ending threshold, advisory only. */
	targetScore?: number;
	/** Shown at player setup, e.g. "one entry per team". */
	setupNote?: string;
	/** Shown on results when ranks tie; no logic. */
	tiebreakNote?: string;
	/** Default "player" — labels the setup screen, nothing else. */
	entry?: "player" | "team";
	/** Tally: points a hand always distributes. ADVISORY — never blocks a save. */
	handTotal?: number;
};

export type Category = {
	/** Unique within the template, stable. */
	key: string;
	/** Translatable. */
	label: string;
	/** Non-zero integer, default 1. */
	multiplier?: number;
	/** Positive integer, default 1. Never a fractional multiplier. */
	divideBy?: number;
	/** Optional entry help, translatable. */
	hint?: string;
};
