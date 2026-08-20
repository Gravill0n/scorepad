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
import { loadSessions } from "@/lib/sessions";
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
