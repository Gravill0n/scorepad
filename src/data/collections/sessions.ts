import { createCollection } from "@tanstack/db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import type { QueryClient } from "@tanstack/react-query";
import { getSessions } from "@/server/functions/sessions";

export const sessionsCollection = (queryClient: QueryClient) =>
	createCollection(
		queryCollectionOptions({
			queryClient,
			queryKey: ["sessions"],
			queryFn: async () => getSessions(),
			getKey: (session) => session.id,
		}),
	);
