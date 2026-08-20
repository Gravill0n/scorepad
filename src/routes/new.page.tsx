import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/new")({ component: NewGame });

function NewGame() {
	return <main>New game</main>;
}
