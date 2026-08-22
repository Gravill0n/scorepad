import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { templates } from "@/lib/templates/registry";
import { GameShelf } from "./GameShelf";

const setupRoute = createRoute({
	getParentRoute: () => root,
	path: "/new/players",
	component: () => <p>setup for {setupRoute.useSearch().template}</p>,
	validateSearch: (search: Record<string, unknown>) => ({
		template: String(search.template ?? ""),
	}),
});

const root = createRootRoute();
const picker = createRoute({
	getParentRoute: () => root,
	path: "/new",
	component: GameShelf,
});

const renderShelf = async () => {
	const router = createRouter({
		routeTree: root.addChildren([picker, setupRoute]),
		history: createMemoryHistory({ initialEntries: ["/new"] }),
	});
	render(<RouterProvider router={router} />);
	// The picker is not the index route, so the first navigation resolves a
	// tick after mount.
	await screen.findByRole("textbox");
	return router;
};

const filter = () => screen.getByRole("textbox");

describe("the shelf", () => {
	it("shows every registered template, counter included", async () => {
		await renderShelf();
		for (const template of templates) {
			expect(screen.getByRole("link", { name: new RegExp(template.name) }));
		}
		expect(screen.getAllByRole("link")).toHaveLength(templates.length);
	});

	it("counts the games in the filter placeholder rather than saying ten", async () => {
		await renderShelf();
		expect(filter().getAttribute("placeholder")).toBe(
			`Filter ${templates.length} games`,
		);
	});

	it("narrows to what the filter matches, ignoring case", async () => {
		await renderShelf();
		fireEvent.change(filter(), { target: { value: "wing" } });
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByRole("link", { name: /Wingspan/ })).toBeDefined();
	});

	it("names the typed string and the whole closed set when nothing matches", async () => {
		await renderShelf();
		fireEvent.change(filter(), { target: { value: "krib" } });
		expect(screen.getByRole("heading", { name: /krib/ })).toBeDefined();
		expect(screen.getByText(/Catan · Splendor/)).toBeDefined();
		expect(screen.queryAllByRole("link")).toHaveLength(0);
	});

	it("returns every game in one tap from a no-match state", async () => {
		await renderShelf();
		fireEvent.change(filter(), { target: { value: "krib" } });
		// The footer action, by its visible label — the × inside the field is
		// the same action and carries the same accessible name.
		fireEvent.click(screen.getByText("Clear the filter"));
		expect(screen.getAllByRole("link")).toHaveLength(templates.length);
		expect((filter() as HTMLInputElement).value).toBe("");
	});

	it("carries the template id to player setup", async () => {
		const router = await renderShelf();
		fireEvent.click(screen.getByRole("link", { name: /Wingspan/ }));
		await screen.findByText("setup for wingspan");
		expect(router.state.location.search).toEqual({ template: "wingspan" });
	});

	it("says nothing about a game's mode in colour alone", async () => {
		await renderShelf();
		// The badge is words, not a hue: two signal colours, and neither is
		// spendable on "this one is a tally game".
		expect(screen.getAllByText("Tally").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Sheet").length).toBeGreaterThan(0);
	});
});
