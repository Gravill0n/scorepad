import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main>
			<h1>Scorepad</h1>
		</main>
	);
}
