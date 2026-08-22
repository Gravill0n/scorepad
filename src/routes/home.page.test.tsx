import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { closeDatabase } from "@/lib/db";
import { createSession, loadSessions } from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import { overwriteGetLocale, overwriteSetLocale } from "@/paraglide/runtime";
import { Route } from "./home.page";

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const Home = Route.options.component;
if (!Home) throw new Error("the home route has no component");

const renderHome = () => {
	const root = createRootRoute();
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => (
			<AppProvider>
				<Home />
			</AppProvider>
		),
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

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
	vi.stubGlobal("matchMedia", () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
	overwriteGetLocale(() => "en");
	overwriteSetLocale(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Home", () => {
	it("shows the first-run state when nothing has been scored", async () => {
		renderHome();
		expect(await screen.findByText("Nothing scored yet")).toBeDefined();
	});

	/**
	 * The reason this suite renders the populated body at all. `New game` used
	 * to live only in `EmptyHome`, so scoring one game replaced the single route
	 * to the picker and a second game could not be started — and every test here
	 * rendered the empty state, which is exactly why nothing caught it.
	 */
	it("still offers New game once there is a session to list", async () => {
		const counter = templates.find((each) => each.id === "counter");
		if (!counter) throw new Error("the counter template is missing");
		await createSession({
			template: counter,
			players: [
				{ name: "Alice", colorIndex: 1 },
				{ name: "Bob", colorIndex: 2 },
			],
			locale: "en",
		});
		await loadSessions();

		renderHome();

		const link = await screen.findByRole("link", { name: /New game/ });
		expect(link.getAttribute("href")).toBe("/new");
	});

	it("always shows the wordmark and the two settings", async () => {
		renderHome();
		expect(
			await screen.findByRole("heading", { name: "Scorepad" }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: /Switch language/ }),
		).toBeDefined();
		expect(
			screen.getByRole("button", { name: /Switch to dark theme/ }),
		).toBeDefined();
	});
});
