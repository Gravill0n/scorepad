import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/session/$id/history")({
	component: HandHistory,
});

function HandHistory() {
	return <main>Hand history</main>;
}
