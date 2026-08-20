import { EmptyHome } from "./EmptyHome";

type HomeBodyProps = {
	sessionCount: number;
	status: "loading" | "ready";
};

/**
 * Which of Home's three bodies to draw.
 *
 * The loading case is not decoration: on a cold start the store is empty
 * because it has not been read yet, and rendering the first-run state from that
 * would tell somebody with twenty games that they have none.
 */
export const HomeBody = ({ sessionCount, status }: HomeBodyProps) => {
	if (status === "loading") return <div className="flex-1" />;
	if (sessionCount === 0) return <EmptyHome />;
	return <div className="flex-1" />;
};
