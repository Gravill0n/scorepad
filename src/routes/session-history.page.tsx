import { createFileRoute, Navigate } from "@tanstack/react-router";
import { HandHistory } from "@/features/scoresheet/components/HandHistory";
import { useSessions, useSessionsStatus } from "@/lib/sessions";

export const Route = createFileRoute("/session/$id/history")({
	component: HandHistoryPage,
});

function HandHistoryPage() {
	const { id } = Route.useParams();
	const status = useSessionsStatus();
	const session = useSessions().find((candidate) => candidate.id === id);

	// The store is read once at boot; until it lands, "not found" is a lie.
	if (status === "loading") return <div className="h-dvh bg-paper" />;
	if (!session) return <Navigate to="/" replace />;

	// The ledger is a tally artefact: a sheet holds exactly one round forever.
	if (session.mode !== "tally")
		return <Navigate to="/session/$id" params={{ id }} replace />;

	return <HandHistory session={session} />;
}
