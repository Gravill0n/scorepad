import type { Template } from "@/types/template";
import type { SetupRow } from "./setupRows";

/**
 * A reason code, not a sentence. The wording lives in the message files, and
 * the same code reads differently for a template whose rows are teams.
 */
export type SetupProblem =
	| "too-few"
	| "too-many"
	| "empty-name"
	| "duplicate-name";

/**
 * The only blocking validation in the app (`1i`). Everything else — an
 * unbalanced hand, a passed target, an empty cell at Results — is advisory.
 *
 * Returns the first problem or `null`. One reason at a time: the screen states
 * it twice, and stating four at once is a wall, not an instruction.
 */
export const validateSetup = (
	rows: SetupRow[],
	template: Template,
): SetupProblem | null => {
	const [min, max] = template.players;
	const names = rows.map((row) => row.name.trim());

	if (rows.length < min) return "too-few";
	if (rows.length > max) return "too-many";
	if (names.some((name) => name === "")) return "empty-name";

	// Case-insensitive: two rows called "Marie" and "marie" carry the same
	// token and the same initial, which is the thing uniqueness is protecting.
	const seen = new Set(names.map((name) => name.toLocaleLowerCase()));
	return seen.size === names.length ? null : "duplicate-name";
};
