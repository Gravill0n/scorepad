import { TriangleAlert } from "lucide-react";
import { m } from "@/paraglide/messages";
import type { Template } from "@/types/template";
import type { SetupProblem } from "../utils/validateSetup";

/** The one blocking message in the app, worded for players or for teams. */
export const problemMessage = (
	problem: SetupProblem,
	template: Template,
): string => {
	const [min, max] = template.players;
	const game = template.name;
	const isTeam = template.entry === "team";

	switch (problem) {
		case "too-few":
			return isTeam
				? m.setup_error_too_few_teams({ game, min })
				: m.setup_error_too_few({ game, min });
		case "too-many":
			return isTeam
				? m.setup_error_too_many_teams({ game, max })
				: m.setup_error_too_many({ game, max });
		case "empty-name":
			return isTeam ? m.setup_error_empty_teams() : m.setup_error_empty();
		default:
			return isTeam
				? m.setup_error_duplicate_teams()
				: m.setup_error_duplicate();
	}
};

/** What to do about it, under the dimmed primary — the second statement (`1i`). */
export const problemAction = (problem: SetupProblem): string =>
	problem === "too-few" || problem === "too-many"
		? m.setup_fix_count()
		: m.setup_fix_names();

/**
 * Auto-height, never a fixed pill and never a toast: a toast is gone before it
 * is read, and the French string is longer than the English one.
 */
export const SetupProblemBanner = ({
	problem,
	template,
}: {
	problem: SetupProblem;
	template: Template;
}) => (
	<p
		role="alert"
		className="mt-3.5 flex gap-2.5 rounded-card border border-alarm bg-alarm-bg p-3.5 text-meta leading-normal text-alarm-ink text-pretty"
	>
		<TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
		{problemMessage(problem, template)}
	</p>
);
