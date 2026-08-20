import type { Category } from "./template";

export type Session = {
	/** crypto.randomUUID() */
	id: string;
	/** Defaults to template name + date. */
	name: string;
	/** Always set — counter mode is counter.json, not null. */
	templateId: string;
	/** Snapshot. */
	mode: "sheet" | "tally";
	/** Snapshot; survives template changes. */
	categories: Category[];
	/** Snapshot. */
	win: "highest" | "lowest";
	/** Snapshot. */
	targetScore?: number;
	/** Snapshot. */
	tiebreakNote?: string;
	/** Snapshot — advisory hand balance (tally only). */
	handTotal?: number;
	/** Snapshot — labels only. */
	entry?: "player" | "team";
	players: Player[];
	/** Sheet mode: exactly one, forever. */
	rounds: Round[];
	status: "active" | "finished";
	/** ISO 8601 */
	createdAt: string;
	finishedAt?: string;
};

export type Player = {
	id: string;
	/** May name a team, not just a person. */
	name: string;
	/** 1–12, indexes --player-01…12 in tokens.css. Never a hex. */
	colorIndex: number;
	/** Seat order — the order players were added. Never rewritten by scoring. */
	sortOrder: number;
};

/** rounds[r][playerId][categoryKey] = raw entered value, before multiplier/divideBy. */
export type Round = Record<string, Record<string, number>>;
