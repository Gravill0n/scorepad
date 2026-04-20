import { useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import { sessionsCollection } from "@/data/collections/sessions";

export const Route = createFileRoute("/")({
	component: Home,
	context: ({ context }) => ({ queryClient: context.queryClient }),
});

function Home() {
	const { queryClient } = Route.useRouteContext();

	const { data: sessions } = useLiveQuery(
		(q) =>
			q
				.from({ sessions: sessionsCollection(queryClient) })
				.select(({ sessions }) => ({ id: sessions.id, name: sessions.name })),
		[queryClient],
	);

	return (
		<main>
			<h1>Board Game Counter</h1>
			<p>Track scores for any board game, anywhere.</p>
		</main>
	);
}
