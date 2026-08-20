import { templateSchema } from "@/types/template";

/**
 * Turns a zod path into something a person can act on. Category issues arrive
 * as `categories.0.divideBy`; the index alone means opening the file and
 * counting, so substitute the key when the input has one.
 */
const describePath = (path: PropertyKey[], template: unknown): string => {
	const categories = (template as { categories?: { key?: unknown }[] })
		?.categories;
	const key =
		path[0] === "categories" && typeof path[1] === "number"
			? categories?.[path[1]]?.key
			: undefined;

	const readable =
		typeof key === "string"
			? [`categories["${key}"]`, ...path.slice(2)]
			: [...path];

	return readable.join(".");
};

/**
 * Every rule in template-grammar.md. Returns the full list of problems rather
 * than throwing on the first, because a broken template usually breaks in more
 * than one way and the template suite wants all of them.
 *
 * Takes `unknown` on purpose: the input is hand-written JSON, and catching what
 * TypeScript cannot is the entire reason this exists.
 */
export const validateTemplate = (
	template: unknown,
	filenameStem: string,
): string[] => {
	const result = templateSchema.safeParse(template);

	const problems = result.success
		? []
		: result.error.issues.map((issue) => {
				const where = describePath(issue.path, template);
				return where ? `${where}: ${issue.message}` : issue.message;
			});

	// Checked independently of the parse, so a file that fails both reports
	// both rather than hiding the filename mismatch behind a shape error.
	const id = (template as { id?: unknown })?.id;
	if (id !== filenameStem) {
		problems.push(
			`id "${String(id)}" does not match filename "${filenameStem}"`,
		);
	}

	return problems;
};
