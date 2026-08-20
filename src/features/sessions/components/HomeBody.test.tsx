import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { HomeBody } from "./HomeBody";

const renderScreen = (element: ReactNode) => {
	const root = createRootRoute();
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <>{element}</>,
	});
	const picker = createRoute({
		getParentRoute: () => root,
		path: "/new",
		component: () => <p>picker</p>,
	});

	return render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([home, picker]),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);
};

const withSentinel = (element: ReactNode) => (
	<>
		{element}
		<span data-testid="painted" />
	</>
);

/** Only meaningful once the router has painted, which the sentinel proves. */
const waitForPaint = () => screen.findByTestId("painted");

describe("HomeBody", () => {
	it("shows the first-run state once the store is read and holds nothing", async () => {
		renderScreen(<HomeBody sessionCount={0} status="ready" />);
		expect(await screen.findByText("Nothing scored yet")).toBeDefined();
	});

	it("shows no first-run state while the store is still being read", async () => {
		// An empty store during a cold read means "not known yet", not "empty".
		renderScreen(withSentinel(<HomeBody sessionCount={0} status="loading" />));
		await waitForPaint();
		expect(screen.queryByText("Nothing scored yet")).toBeNull();
	});

	it("shows no first-run state when sessions exist", async () => {
		renderScreen(withSentinel(<HomeBody sessionCount={3} status="ready" />));
		await waitForPaint();
		expect(screen.queryByText("Nothing scored yet")).toBeNull();
	});

	it("still shows the first-run state when the sentinel is present", async () => {
		// Proves the sentinel does not suppress the thing the two tests above
		// assert the absence of.
		renderScreen(withSentinel(<HomeBody sessionCount={0} status="ready" />));
		await waitForPaint();
		expect(screen.queryByText("Nothing scored yet")).not.toBeNull();
	});
});
