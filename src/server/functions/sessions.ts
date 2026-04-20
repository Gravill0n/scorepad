import { getAllSessions } from "@Server/database/sessions.server";
import { createServerFn } from "@tanstack/react-start";

// TODO auto filter by hostID
export const getSessions = createServerFn({ method: "GET" }).handler(
	async () => {
		return await getAllSessions();
	},
);
