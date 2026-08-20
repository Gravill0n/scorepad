import { createFileRoute } from "@tanstack/react-router";

/** The picker carries the chosen template here (`1f` → `1h`). */
export const Route = createFileRoute("/new/players")({
	component: PlayerSetup,
	validateSearch: (search: Record<string, unknown>) => ({
		template: typeof search.template === "string" ? search.template : "",
	}),
});

function PlayerSetup() {
	const { template } = Route.useSearch();
	return <main>Players: {template}</main>;
}
