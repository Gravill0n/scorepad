import { z } from "zod";

/**
 * A template is data, never code. One generic renderer draws any template.
 *
 * The schema is the definition and the type is inferred from it, so there is
 * exactly one place a grammar field is declared. Templates are hand-written
 * JSON: TypeScript cannot check them, and every field here is a permanent
 * compatibility surface.
 */
export const categorySchema = z.strictObject({
	/** Unique within the template, stable. */
	key: z.string().regex(/^[a-z][a-z0-9_]*$/, "must match ^[a-z][a-z0-9_]*$"),
	/** Translatable. */
	label: z.string().min(1),
	/** Non-zero integer, default 1. Negative is the negative-category feature. */
	multiplier: z
		.int()
		.refine((n) => n !== 0, "must be a non-zero integer")
		.optional(),
	/** Positive integer, default 1. Never a fractional multiplier. */
	divideBy: z.int().positive().optional(),
	/** Optional entry help, translatable. */
	hint: z.string().optional(),
});

export const templateSchema = z
	.strictObject({
		/** Stable slug; the filename stem must match. */
		id: z.string().min(1),
		/** Display name, not translated (proper noun). */
		name: z.string().min(1),
		/** [min, max] inclusive. */
		players: z.tuple([z.int().min(1), z.int()]),
		mode: z.enum(["sheet", "tally"]),
		/** 1..n, order is entry order. */
		categories: z.array(categorySchema).min(1),
		win: z.enum(["highest", "lowest"]),
		/** Game-ending threshold, advisory only. */
		targetScore: z.int().optional(),
		/** Shown at player setup, e.g. "one entry per team". */
		setupNote: z.string().optional(),
		/** Shown on results when ranks tie; no logic. */
		tiebreakNote: z.string().optional(),
		/** Default "player" — labels the setup screen, nothing else. */
		entry: z.enum(["player", "team"]).optional(),
		/** Tally: points a hand always distributes. ADVISORY — never blocks a save. */
		handTotal: z
			.int()
			.refine((n) => n !== 0, "must be a non-zero integer")
			.optional(),
	})
	// Rules that span more than one field, so they cannot live on it.
	.superRefine((template, ctx) => {
		const [min, max] = template.players;
		if (max < min) {
			ctx.addIssue({
				code: "custom",
				path: ["players"],
				message: `maximum ${max} is below minimum ${min}`,
			});
		}

		const seen = new Set<string>();
		template.categories.forEach((category, index) => {
			if (seen.has(category.key)) {
				ctx.addIssue({
					code: "custom",
					path: ["categories", index, "key"],
					message: `duplicate key "${category.key}"`,
				});
			}
			seen.add(category.key);
		});

		if (template.handTotal !== undefined && template.mode === "sheet") {
			ctx.addIssue({
				code: "custom",
				path: ["handTotal"],
				message: "is not allowed on a sheet template",
			});
		}
	});

export type Template = z.infer<typeof templateSchema>;
export type Category = z.infer<typeof categorySchema>;
