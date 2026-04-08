import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/test")({ component: Test });

function Test() {
	return (
		<main>
			<h1 className="text-red-500">Test</h1>
			<p>Track scores for any board game, anywhere.</p>
		</main>
	);
}
