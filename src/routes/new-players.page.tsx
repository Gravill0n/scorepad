import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/new/players")({
	component: PlayerSetup,
});

function PlayerSetup() {
	return <main>Players</main>;
}
