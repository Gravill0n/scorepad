import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PlayerSetup } from "@/features/sessions/components/PlayerSetup";
import { templates } from "@/lib/templates/registry";

/** The picker carries the chosen template here (`1f` → `1h`). */
export const Route = createFileRoute("/new/players")({
	component: PlayerSetupPage,
	validateSearch: (search: Record<string, unknown>) => ({
		template: typeof search.template === "string" ? search.template : "",
	}),
});

function PlayerSetupPage() {
	const { template: id } = Route.useSearch();
	const template = templates.find((candidate) => candidate.id === id);

	// A hand-typed or stale link names a template that is not on the shelf.
	// The shelf is the only way in, so it is also the way back.
	if (!template) return <Navigate to="/new" replace />;

	return <PlayerSetup template={template} />;
}
