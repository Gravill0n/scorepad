import type { Template } from "@/types/template";

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const isNonZeroInteger = (n: number) => Number.isInteger(n) && n !== 0;

/**
 * Every rule in template-grammar.md, checked at build time by the template
 * suite. Returns the full list of problems rather than throwing on the first,
 * because a broken template usually breaks in more than one way.
 */
export const validateTemplate = (
	template: Template,
	filenameStem: string,
): string[] => {
	const problems: string[] = [];

	if (template.id !== filenameStem) {
		problems.push(
			`id "${template.id}" does not match filename "${filenameStem}"`,
		);
	}

	if (template.categories.length === 0) {
		problems.push("categories is empty");
	}

	const seen = new Set<string>();
	for (const category of template.categories) {
		if (seen.has(category.key)) {
			problems.push(`duplicate category key "${category.key}"`);
		}
		seen.add(category.key);

		if (!KEY_PATTERN.test(category.key)) {
			problems.push(`category key "${category.key}" must match ${KEY_PATTERN}`);
		}
		if (
			category.multiplier !== undefined &&
			!isNonZeroInteger(category.multiplier)
		) {
			problems.push(
				`category "${category.key}" multiplier must be a non-zero integer`,
			);
		}
		if (
			category.divideBy !== undefined &&
			!(Number.isInteger(category.divideBy) && category.divideBy > 0)
		) {
			problems.push(
				`category "${category.key}" divideBy must be a positive integer`,
			);
		}
	}

	if (
		!Array.isArray(template.players) ||
		template.players.length !== 2 ||
		!template.players.every((n) => Number.isInteger(n))
	) {
		problems.push("players must be exactly two integers, [min, max]");
	} else {
		const [min, max] = template.players;
		if (min < 1) problems.push(`players minimum ${min} is below 1`);
		if (max < min)
			problems.push(`players maximum ${max} is below minimum ${min}`);
	}

	if (template.handTotal !== undefined) {
		if (!isNonZeroInteger(template.handTotal)) {
			problems.push("handTotal must be a non-zero integer");
		}
		if (template.mode === "sheet") {
			problems.push("handTotal is not allowed on a sheet template");
		}
	}

	// The next three are widened deliberately. Template already narrows them, but
	// registry.ts casts the imported JSON with `as Template[]`, so TypeScript is
	// not actually checking these values — and `win` silently reverses the
	// ranking direction if it is wrong.
	const mode: string = template.mode;
	if (mode !== "sheet" && mode !== "tally") {
		problems.push(`mode "${mode}" must be "sheet" or "tally"`);
	}

	const win: string = template.win;
	if (win !== "highest" && win !== "lowest") {
		problems.push(`win "${win}" must be "highest" or "lowest"`);
	}

	const entry: string | undefined = template.entry;
	if (entry !== undefined && entry !== "player" && entry !== "team") {
		problems.push(`entry "${entry}" must be "player" or "team"`);
	}

	return problems;
};
