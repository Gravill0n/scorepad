import { z } from "zod";
import { categorySchema } from "./template";

/**
 * A cell resolves to a defined zero rather than letting a bad value through.
 * scoring.ts applies the same rule when it reads an entry; this is it at the
 * storage boundary, so one corrupted cell never costs a whole evening's game.
 */
const cellValue = z.number().catch(0);

export const playerSchema = z.object({
	id: z.string(),
	/** May name a team, not just a person. */
	name: z.string(),
	/** 1–12, indexes --player-01…12 in tokens.css. Never a hex. */
	colorIndex: z.int(),
	/** Seat order — the order players were added. Never rewritten by scoring. */
	sortOrder: z.int(),
});

/** rounds[r][playerId][categoryKey] = raw entered value, before multiplier/divideBy. */
export const roundSchema = z.record(
	z.string(),
	z.record(z.string(), cellValue),
);

export const sessionSchema = z.object({
	/** crypto.randomUUID() */
	id: z.string(),
	/** Defaults to template name + date. */
	name: z.string(),
	/** Always set — counter mode is counter.json, not null. */
	templateId: z.string(),
	// The snapshot. Survives template changes, so a played score cannot move.
	mode: z.enum(["sheet", "tally"]),
	categories: z.array(categorySchema),
	win: z.enum(["highest", "lowest"]),
	targetScore: z.int().optional(),
	tiebreakNote: z.string().optional(),
	/** Advisory hand balance (tally only). Never blocks a save. */
	handTotal: z.int().optional(),
	/** Labels only. */
	entry: z.enum(["player", "team"]).optional(),
	players: z.array(playerSchema),
	/** Sheet mode: exactly one, forever. */
	rounds: z.array(roundSchema),
	status: z.enum(["active", "finished"]),
	/** ISO 8601 */
	createdAt: z.string(),
	/** ISO 8601 — bumped by every write. "Most recently touched" is this. */
	updatedAt: z.string(),
	finishedAt: z.string().optional(),
});

export type Session = z.infer<typeof sessionSchema>;
export type Player = z.infer<typeof playerSchema>;
export type Round = z.infer<typeof roundSchema>;
