import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { m } from "@/paraglide/messages";

/**
 * Home's primary action, in both of Home's states.
 *
 * It is shared because it was once not: the link lived inside `EmptyHome`
 * alone, so the moment somebody had a single session the populated list
 * replaced the only way to start another one and the app was a dead end.
 * `SPEC.md` §1 gives `1d` and `1e` the same pinned footer primary; only the
 * first-run footer adds `Import a backup` beside it.
 */
export const NewGameLink = () => (
	<Link
		to="/new"
		className="btn-primary flex h-[var(--h-primary)] items-center justify-center gap-2 rounded-ctrl text-row font-[var(--weight-medium)]"
	>
		<Plus size={18} aria-hidden="true" />
		{m.home_new_game()}
	</Link>
);
