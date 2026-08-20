import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { closeDatabase, getAllSessions, getMeta, putMeta } from "@/lib/db";
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
		component: () => (
			<AppProvider>
				<PlayerSetup template={find(id)} />
			</AppProvider>
		),
	});
	const picker = createRoute({
		getParentRoute: () => root,
		path: "/new",
		component: () => <p>shelf</p>,
	});
	const sheet = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => <p>scoresheet</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([setup, picker, sheet]),
				history: createMemoryHistory({ initialEntries: ["/new/players"] }),
			})}
		/>,
	);
	await screen.findByRole("heading");
};

const nameFields = () => screen.getAllByRole("textbox") as HTMLInputElement[];

const firstButton = (name: RegExp) => {
	const [button] = screen.getAllByRole("button", { name });
	if (!button) throw new Error(`no button matching ${name}`);
	return button;
};

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
		const [first] = nameFields();
		fireEvent.change(first as HTMLInputElement, { target: { value: "Marie" } });
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
		fireEvent.click(firstButton(/Remove/));
		expect(nameFields()).toHaveLength(1);
		fireEvent.click(firstButton(/Remove/));
		expect(nameFields()).toHaveLength(1);
	});
});

describe("blocking validation and the write that starts the game", () => {
	const type = (field: HTMLInputElement, value: string) =>
		fireEvent.change(field, { target: { value } });

	const primary = () => screen.getByRole("button", { name: "Start scoring" });

	it("blocks an unnamed row, and says so twice", async () => {
		await renderSetup("wingspan");

		expect((primary() as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole("alert").textContent).toContain(
			"Every player needs a name.",
		);
		expect(screen.getByText("Fix the names to continue")).toBeDefined();
	});

	it("blocks two teams that share a name — the case 1i is drawn on", async () => {
		await renderSetup("belote");
		const [first, second] = nameFields();
		type(first as HTMLInputElement, "Marie & Luc");
		type(second as HTMLInputElement, "Marie & Luc");

		expect((primary() as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole("alert").textContent).toContain(
			"Two teams share a name. Rename one to continue.",
		);
	});

	it("states the reason in prose, not in a fixed pill", async () => {
		await renderSetup("belote");
		const banner = screen.getByRole("alert");
		// Auto-height and wrapping: the French string is the longer one, and the
		// container is sized for it.
		expect(banner.className).not.toMatch(/\bh-\[/);
		expect(banner.className).toContain("leading-normal");
		expect(banner.className).toContain("text-alarm-ink");
		expect(banner.className).toContain("bg-alarm-bg");
	});

	it("unblocks the moment the table is playable", async () => {
		await renderSetup("wingspan");
		const [first, second] = nameFields();
		type(first as HTMLInputElement, "Marie");
		type(second as HTMLInputElement, "Luc");

		expect((primary() as HTMLButtonElement).disabled).toBe(false);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("creates the session, remembers the names and opens the scoresheet", async () => {
		await renderSetup("wingspan");
		const [first, second] = nameFields();
		type(first as HTMLInputElement, "Marie");
		type(second as HTMLInputElement, "Luc");

		fireEvent.click(primary());
		await screen.findByText("scoresheet");

		const stored = await getAllSessions();
		expect(stored).toHaveLength(1);
		expect(stored[0]?.players.map((player) => player.name)).toEqual([
			"Marie",
			"Luc",
		]);
		// The snapshot came from the template, so a later template edit cannot
		// move a played score.
		expect(stored[0]?.categories).toHaveLength(6);
		expect(await getMeta("recentNames")).toEqual(["Marie", "Luc"]);
	});

	it("asks for durable storage, since IndexedDB is the only copy", async () => {
		const persist = vi.fn().mockResolvedValue(true);
		vi.stubGlobal("navigator", {
			...navigator,
			storage: { persist, persisted: vi.fn().mockResolvedValue(false) },
		});

		await renderSetup("wingspan");
		const [first, second] = nameFields();
		type(first as HTMLInputElement, "Marie");
		type(second as HTMLInputElement, "Luc");
		fireEvent.click(primary());
		await screen.findByText("scoresheet");

		expect(persist).toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});

describe("choosing a colour", () => {
	const openColorSheet = async () => {
		await renderSetup("wingspan");
		fireEvent.click(firstButton(/^Colour for/));
		return screen.getByRole("dialog");
	};

	it("opens the sheet from the row's token", async () => {
		const sheet = await openColorSheet();
		expect(sheet.textContent).toContain("Taken colours are dimmed");
	});

	it("refuses the colour another row already holds", async () => {
		await openColorSheet();
		const taken = screen.getByRole("button", {
			name: "Colour 2, already taken",
		});
		fireEvent.click(taken);

		// Still open, still twelve swatches: nothing reflowed under the thumb.
		expect(screen.getByRole("dialog")).toBeDefined();
		expect(taken.hasAttribute("disabled")).toBe(false);
	});

	it("applies the picked colour and closes through the sheet's own exit", async () => {
		const sheet = await openColorSheet();
		fireEvent.click(screen.getByRole("button", { name: "Colour 7" }));

		// The panel animates out first — unmounting an open modal <dialog> would
		// skip --dur-sheet and drop focus on the floor.
		expect(screen.queryByRole("dialog")).not.toBeNull();
		const panel = sheet.querySelector("[class*='rounded-t-card']");
		if (!panel) throw new Error("no sheet panel");
		fireEvent.animationEnd(panel);

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		const token = firstButton(/^Colour for/).firstElementChild;
		expect((token as HTMLElement).style.background).toContain("--player-07");
	});
});
