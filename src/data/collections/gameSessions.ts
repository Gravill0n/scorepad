import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/react-query";
import { getGameSessions } from "@/server/functions/gameSessions";

export const gameSessionsCollection = (queryClient: QueryClient) =>
	createCollection(
		queryCollectionOptions({
			queryClient,
			queryKey: ["sessions"],
			queryFn: async () => getGameSessions(),
			getKey: (session) => session.id,
		}),
	);
