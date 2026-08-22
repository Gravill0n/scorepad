import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

/**
 * Derived from vite's `base`, never written out again: under a project page
 * every route is `/scorepad/...`, and a basepath that disagreed with the asset
 * paths by one character would break every link on the site.
 *
 * Trailing slash trimmed because the router wants `/scorepad`, and at the
 * domain root that leaves an empty string, which means "no basepath".
 */
const basepath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const getRouter = () =>
	createTanStackRouter({
		routeTree,
		basepath: basepath || undefined,
		scrollRestoration: true,
		defaultPreload: "intent",
	});

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
