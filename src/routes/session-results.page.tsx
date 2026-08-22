import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ResultsScreen } from "@/features/scoresheet/components/ResultsScreen";
import { useSessions, useSessionsStatus } from "@/lib/sessions";

export const Route = createFileRoute("/session/$id/results")({
	component: Results,
});

function Results() {
	const { id } = Route.useParams();
	const status = useSessionsStatus();
	const session = useSessions().find((candidate) => candidate.id === id);

	// The store is read once at boot; until it lands, "not found" is a lie.
	if (status === "loading") return <div className="h-dvh bg-paper" />;
	if (!session) return <Navigate to="/" replace />;

	return <ResultsScreen session={session} />;
}
