import { m } from "@/paraglide/messages";
import type { Template } from "@/types/template";

/**
 * The shelf tile's meta line, derived from the template rather than authored
 * per game (`1f`): `6 categories · 1–5`, `to 501 · 2 teams`, `1–12`.
 *
 * Nothing here is stored. A template that gains a target or loses a category
 * says so on the shelf the moment the JSON changes.
 */
export const templateMeta = (template: Template): string => {
	const [min, max] = template.players;

	if (template.mode === "sheet") {
		return m.picker_meta_sheet({
			count: template.categories.length,
			min,
			max,
		});
	}

	if (template.targetScore === undefined) {
		return m.picker_meta_players({ min, max });
	}

	// A team template is always two entries, and saying "2 teams" is clearer
	// than "2–2" for the one shape where the row is not a person.
	return template.entry === "team"
		? m.picker_meta_teams({ target: template.targetScore })
		: m.picker_meta_tally({ target: template.targetScore, min, max });
};
