import type { Session } from "@/types/session";
import { EmptyHome } from "./EmptyHome";
import { SessionList } from "./SessionList";

type HomeBodyProps = {
	sessions: Session[];
	status: "loading" | "ready";
};

/**
 * Which of Home's three bodies to draw.
 *
 * The loading case is not decoration: on a cold start the store is empty
 * because it has not been read yet, and rendering the first-run state from that
 * would tell somebody with twenty games that they have none.
 */
export const HomeBody = ({ sessions, status }: HomeBodyProps) => {
	if (status === "loading") return <div className="flex-1" />;
	if (sessions.length === 0) return <EmptyHome />;
	return <SessionList sessions={sessions} />;
};
