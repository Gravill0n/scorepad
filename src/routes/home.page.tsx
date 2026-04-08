import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main>
			<h1>Board Game Counter</h1>
			<p>Track scores for any board game, anywhere.</p>
		</main>
	)
}
