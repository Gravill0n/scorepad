import { createFileRoute, Navigate } from "@tanstack/react-router";
import { SheetScreen } from "@/features/scoresheet/components/SheetScreen";
import { TallyScreen } from "@/features/scoresheet/components/TallyScreen";
import { useSessions, useSessionsStatus } from "@/lib/sessions";

export const Route = createFileRoute("/session/$id")({ component: Scoresheet });

function Scoresheet() {
	const { id } = Route.useParams();
	const status = useSessionsStatus();
	const session = useSessions().find((candidate) => candidate.id === id);

	// The store is read once at boot; until it lands, "not found" is a lie.
	if (status === "loading") return <div className="h-dvh bg-paper" />;
	if (!session) return <Navigate to="/" replace />;

	if (session.mode === "tally") return <TallyScreen session={session} />;

	return <SheetScreen session={session} />;
}
