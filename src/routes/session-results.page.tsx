import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/session/$id/results")({
	component: Results,
});

function Results() {
	return <main>Results</main>;
}
