import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppProvider } from "@/app/provider";
import type { Session } from "@/types/session";
import { HomeBody } from "./HomeBody";

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Chez Marie",
	templateId: "belote",
	mode: "tally",
	categories: [{ key: "hand", label: "Hand points" }],
	win: "highest",
	targetScore: 501,
	players: [{ id: "p1", name: "Nous", colorIndex: 1, sortOrder: 0 }],
	rounds: [],
	status: "active",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T19:00:00.000Z",
	...overrides,
});

const renderScreen = (element: ReactNode) => {
	const root = createRootRoute();
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <AppProvider>{element}</AppProvider>,
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

beforeEach(() => {
	vi.stubGlobal("matchMedia", () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("HomeBody", () => {
	it("shows the first-run state once the store is read and holds nothing", async () => {
		renderScreen(<HomeBody sessions={[]} status="ready" />);
		expect(await screen.findByText("Nothing scored yet")).toBeDefined();
	});

	it("shows no first-run state while the store is still being read", async () => {
		// An empty store during a cold read means "not known yet", not "empty".
		renderScreen(withSentinel(<HomeBody sessions={[]} status="loading" />));
		await waitForPaint();
		expect(screen.queryByText("Nothing scored yet")).toBeNull();
	});

	it("shows no first-run state when sessions exist", async () => {
		renderScreen(
			withSentinel(<HomeBody sessions={[session()]} status="ready" />),
		);
		await waitForPaint();
		expect(screen.queryByText("Nothing scored yet")).toBeNull();
	});

	it("still shows the first-run state when the sentinel is present", async () => {
		// Proves the sentinel does not suppress the thing the two tests above
		// assert the absence of.
		renderScreen(withSentinel(<HomeBody sessions={[]} status="ready" />));
		await waitForPaint();
		expect(screen.queryByText("Nothing scored yet")).not.toBeNull();
	});
});
