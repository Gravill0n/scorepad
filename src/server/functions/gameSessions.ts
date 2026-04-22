import { createServerFn } from "@tanstack/react-start";
import { getAllGameSessions } from "@/server/database/gameSessions.server";

// TODO auto filter by hostID
export const getGameSessions = createServerFn({ method: "GET" }).handler(
	async () => {
		return await getAllGameSessions();
	},
);
