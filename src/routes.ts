import { index, rootRoute, route } from "@tanstack/virtual-file-routes";

export const routes = rootRoute("root.layout.tsx", [
	index("home.page.tsx"),
	route("test", "test.page.tsx"),
]);
