import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { closeDatabase, putMeta } from "@/lib/db";
import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import { PlayerSetup } from "./PlayerSetup";

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const find = (id: string): Template => {
	const template = templates.find((candidate) => candidate.id === id);
	if (!template) throw new Error(`no template "${id}"`);
	return template;
};

const renderSetup = async (id: string) => {
	const root = createRootRoute();
	const setup = createRoute({
		getParentRoute: () => root,
		path: "/new/players",
		component: () => <PlayerSetup template={find(id)} />,
	});
	const picker = createRoute({
		getParentRoute: () => root,
		path: "/new",
		component: () => <p>shelf</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([setup, picker]),
				history: createMemoryHistory({ initialEntries: ["/new/players"] }),
			})}
		/>,
	);
	await screen.findByRole("heading");
};

const nameFields = () =>
	screen.getAllByRole("textbox") as HTMLInputElement[];

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
});

describe("player setup", () => {
	it("opens with two rows rather than one, even for a game that allows solo", async () => {
		await renderSetup("wingspan");
		expect(nameFields()).toHaveLength(2);
		expect(screen.getByText("Wingspan · 1 to 5")).toBeDefined();
	});

	it("counts the rows against the template's maximum", async () => {
		await renderSetup("wingspan");
		expect(screen.getByText("2 / 5")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Add a player" }));
		expect(screen.getByText("3 / 5")).toBeDefined();
	});

	it("says Teams, not Players, when a row is a team", async () => {
		await renderSetup("belote");
		expect(screen.getByRole("heading", { name: "Teams" })).toBeDefined();
		expect(screen.getByText("Belote · exactly 2 teams")).toBeDefined();
	});

	it("renders a team template's setup note as an advisory banner", async () => {
		await renderSetup("belote");
		expect(screen.getByText(/one row per team/)).toBeDefined();
	});

	it("offers no way to add a row past the template's maximum", async () => {
		await renderSetup("belote");
		expect(screen.queryByRole("button", { name: "Add a team" })).toBeNull();
	});

	it("seats four players in four taps from recent names", async () => {
		await putMeta("recentNames", ["Marie", "Luc", "Sofia", "Tom"]);
		await renderSetup("wingspan");
		await screen.findByRole("button", { name: "Add Marie" });

		for (const name of ["Marie", "Luc", "Sofia", "Tom"]) {
			fireEvent.click(screen.getByRole("button", { name: `Add ${name}` }));
		}

		expect(nameFields().map((field) => field.value)).toEqual([
			"Marie",
			"Luc",
			"Sofia",
			"Tom",
		]);
	});

	it("names each row's controls after the player, for a screen reader", async () => {
		await renderSetup("wingspan");
		fireEvent.change(nameFields()[0] as HTMLInputElement, {
			target: { value: "Marie" },
		});
		expect(screen.getByRole("button", { name: "Remove Marie" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Reorder Marie" })).toBeDefined();
	});

	it("keeps the reorder handle reachable without a gesture", async () => {
		await renderSetup("wingspan");
		// Real buttons, so Tab reaches them: dnd-kit's keyboard sensor drives the
		// same handle a thumb drags.
		for (const handle of screen.getAllByRole("button", { name: /Reorder/ })) {
			expect(handle.tagName).toBe("BUTTON");
		}
	});

	it("removes a row, and keeps the last one", async () => {
		await renderSetup("wingspan");
		fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]!);
		expect(nameFields()).toHaveLength(1);
		fireEvent.click(screen.getAllByRole("button", { name: /Remove/ })[0]!);
		expect(nameFields()).toHaveLength(1);
	});
});
