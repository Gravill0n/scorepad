import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/session/$id")({ component: Scoresheet });

function Scoresheet() {
	return <main>Scoresheet</main>;
}
