import { length, useLiveQuery } from "@tanstack/react-db";
import type { QueryClient } from "@tanstack/react-query";
import { gameSessionsCollection } from "../collections/gameSessions";

export const useGetAllGameSessions = (queryClient: QueryClient) => {
	return useLiveQuery(
		(q) =>
			q
				.from({ gameSessions: gameSessionsCollection(queryClient) })
				.select(({ gameSessions }) => ({
					id: gameSessions.id,
					name: gameSessions.name,
					status: gameSessions.status,
					nbPlayers: length(gameSessions.players),
				})),
		[queryClient],
	);
};
