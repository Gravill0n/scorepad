import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import type { Session } from "@/types/session";
import { SheetScreen } from "./SheetScreen";

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Sunday table",
	templateId: "wingspan",
	mode: "sheet",
	categories: [
		{ key: "birds", label: "Birds" },
		{ key: "bonus", label: "Bonus cards" },
		{ key: "goals", label: "End-of-round goals", hint: "Count the cubes" },
	],
	win: "highest",
	players: [
		{ id: "p1", name: "Marie", colorIndex: 1, sortOrder: 0 },
		{ id: "p2", name: "Luc", colorIndex: 2, sortOrder: 1 },
		{ id: "p3", name: "Sofia", colorIndex: 3, sortOrder: 2 },
	],
	rounds: [{ p1: { birds: 12 }, p2: { birds: 30 } }],
	status: "active",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T19:00:00.000Z",
	...overrides,
});

const renderSheet = async (value = session()) => {
	const root = createRootRoute();
	const sheet = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => (
			<AppProvider>
				<SheetScreen session={value} />
			</AppProvider>
		),
	});
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <p>home</p>,
	});
	const results = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/results",
		component: () => <p>results</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([sheet, home, results]),
				history: createMemoryHistory({ initialEntries: ["/session/s1"] }),
			})}
		/>,
	);
	await screen.findByRole("heading", { name: "Sunday table" });
};

const rowNames = () =>
	screen.getAllByRole("listitem").map((row) => row.textContent ?? "");

describe("the scoresheet", () => {
	it("names the session, the game and the table size", async () => {
		await renderSheet();
		expect(screen.getByText("Wingspan · 3 players")).toBeDefined();
	});

	it("opens on the first category, with its rule in full", async () => {
		await renderSheet();
		expect(screen.getByRole("heading", { name: "Birds" })).toBeDefined();
		expect(screen.getByText("Category 1 of 3")).toBeDefined();
	});

	it("shows one row per player, in seat order", async () => {
		await renderSheet();
		const names = rowNames();
		expect(names[0]).toContain("Marie");
		expect(names[1]).toContain("Luc");
		expect(names[2]).toContain("Sofia");
	});

	it("does not reorder rows when a total puts a player ahead", async () => {
		// Luc leads on points; Marie still sits in seat one.
		await renderSheet();
		expect(rowNames()[0]).toContain("Marie");
		expect(rowNames()[0]).toContain("2nd");
		expect(rowNames()[1]).toContain("Luc");
		expect(rowNames()[1]).toContain("1st");
	});

	it("marks a tie rather than breaking it", async () => {
		await renderSheet(
			session({ rounds: [{ p1: { birds: 10 }, p2: { birds: 10 } }] }),
		);
		const tied = rowNames().filter((row) => row.includes("1st="));
		expect(tied).toHaveLength(2);
	});

	it("renders an empty cell as an em-dash, not as a zero", async () => {
		await renderSheet();
		expect(
			screen.getByRole("button", { name: "Sofia: not entered" }).textContent,
		).toBe("—");
		expect(screen.getByRole("button", { name: "Marie: 12" }).textContent).toBe(
			"12",
		);
	});

	it("lets any category be revisited from the strip", async () => {
		await renderSheet();
		fireEvent.click(
			screen.getByRole("button", { name: "Category 3, End-of-round goals" }),
		);
		expect(
			screen.getByRole("heading", { name: "End-of-round goals" }),
		).toBeDefined();
		expect(screen.getByText("Count the cubes")).toBeDefined();
	});

	it("walks forward with the footer, and offers results on the last one", async () => {
		await renderSheet();
		fireEvent.click(screen.getByRole("button", { name: /Next category/ }));
		fireEvent.click(screen.getByRole("button", { name: /Next category/ }));
		expect(screen.getByRole("button", { name: /See results/ })).toBeDefined();
	});

	it("actually goes to Results from the last category", async () => {
		await renderSheet();
		fireEvent.click(screen.getByRole("button", { name: /Next category/ }));
		fireEvent.click(screen.getByRole("button", { name: /Next category/ }));

		const results = screen.getByRole("button", { name: /See results/ });
		expect((results as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(results);
		await screen.findByText("results");
	});

	it("counts entered cells in the pager, not players", async () => {
		await renderSheet();
		expect(screen.getByRole("img", { name: "2 of 3 entered" })).toBeDefined();
	});

	it("abbreviates the strip from the labels, three letters at a time", async () => {
		await renderSheet();
		expect(screen.getByText("BIR")).toBeDefined();
		expect(screen.getByText("BON")).toBeDefined();
		expect(screen.getByText("END")).toBeDefined();
	});
});
