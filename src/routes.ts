import { index, rootRoute, route } from "@tanstack/virtual-file-routes";

/** The whole app. Six screens, flat — every one is a full page. */
export const routes = rootRoute("root.layout.tsx", [
	index("home.page.tsx"),
	route("/new", "new.page.tsx"),
	route("/new/players", "new-players.page.tsx"),
	route("/session/$id", "session.page.tsx"),
	route("/session/$id/history", "session-history.page.tsx"),
	route("/session/$id/results", "session-results.page.tsx"),
]);
