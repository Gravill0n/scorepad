import { createFileRoute } from "@tanstack/react-router";
import { HomeBody } from "@/features/sessions/components/HomeBody";
import { HomeHeader } from "@/features/sessions/components/HomeHeader";
import { useSessions, useSessionsStatus } from "@/lib/sessions";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	const sessions = useSessions();
	const status = useSessionsStatus();

	return (
		<div className="flex h-dvh flex-col">
			<HomeHeader />
			<HomeBody sessions={sessions} status={status} />
		</div>
	);
}
