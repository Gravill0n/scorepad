import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { closeDatabase, getAllSessions } from "@/lib/db";
import { createSession, getSessions, loadSessions } from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import { SessionList } from "./SessionList";

const belote = templates.find((t) => t.id === "belote") as Template;

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const renderList = () => {
	const root = createRootRoute();
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => (
			<AppProvider>
				<SessionList sessions={getSessions()} />
			</AppProvider>
		),
	});
	const sheet = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => <p>sheet</p>,
	});
	const results = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/results",
		component: () => <p>results</p>,
	});

	return render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([home, sheet, results]),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);
};

const seed = () =>
	createSession({
		template: belote,
		players: [
			{ name: "Nous", colorIndex: 1 },
			{ name: "Eux", colorIndex: 2 },
		],
		name: "Belote 12 Apr",
	});

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
	vi.stubGlobal("matchMedia", () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("row actions", () => {
	it("reaches Delete and Duplicate without the gesture", async () => {
		await seed();
		renderList();

		// Real buttons after the row in DOM order, so Tab arrives at them.
		expect(
			await screen.findByRole("button", { name: "Duplicate" }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Delete" })).toBeDefined();
	});

	it("duplicates immediately, with no rename prompt", async () => {
		await seed();
		renderList();

		(await screen.findByRole("button", { name: "Duplicate" })).click();

		await waitFor(async () => expect(await getAllSessions()).toHaveLength(2));
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("gives the copy the same players and colours, a new id and no scores", async () => {
		const original = await seed();
		renderList();
		(await screen.findByRole("button", { name: "Duplicate" })).click();

		await waitFor(async () => expect(await getAllSessions()).toHaveLength(2));
		const copy = (await getAllSessions()).find((s) => s.id !== original.id);

		expect(copy?.name).toBe("Belote 12 Apr (2)");
		expect(copy?.players.map((p) => p.name)).toEqual(["Nous", "Eux"]);
		expect(copy?.players.map((p) => p.colorIndex)).toEqual([1, 2]);
		expect(copy?.id).not.toBe(original.id);
		expect(copy?.rounds).toEqual([]);
	});

	it("increments the suffix rather than colliding on a second copy", async () => {
		await seed();
		renderList();

		(await screen.findByRole("button", { name: "Duplicate" })).click();
		await waitFor(async () => expect(await getAllSessions()).toHaveLength(2));

		screen.getAllByRole("button", { name: "Duplicate" })[0]?.click();
		await waitFor(async () => expect(await getAllSessions()).toHaveLength(3));

		const names = (await getAllSessions()).map((s) => s.name).sort();
		expect(names).toEqual([
			"Belote 12 Apr",
			"Belote 12 Apr (2)",
			"Belote 12 Apr (3)",
		]);
	});
});

describe("deleting a session", () => {
	it("asks before removing anything", async () => {
		await seed();
		renderList();

		(await screen.findByRole("button", { name: "Delete" })).click();

		expect(await screen.findByText("Delete this game?")).toBeDefined();
		expect(await getAllSessions()).toHaveLength(1);
	});

	it("names the session it is about to remove", async () => {
		await seed();
		renderList();
		(await screen.findByRole("button", { name: "Delete" })).click();

		expect(await screen.findByText(/Belote 12 Apr/)).toBeDefined();
	});

	it("keeps the session when the confirmation is declined", async () => {
		await seed();
		renderList();
		(await screen.findByRole("button", { name: "Delete" })).click();
		(await screen.findByRole("button", { name: "Keep it" })).click();

		await waitFor(() =>
			expect(screen.queryByText("Delete this game?")).toBeNull(),
		);
		expect(await getAllSessions()).toHaveLength(1);
	});

	it("removes the session once confirmed", async () => {
		await seed();
		renderList();
		(await screen.findByRole("button", { name: "Delete" })).click();

		// The row's swipe action and the dialog's confirm share a label, so the
		// confirm has to be found inside the dialog rather than by name alone.
		const dialog = await screen.findByRole("dialog");
		within(dialog).getByRole("button", { name: "Delete" }).click();

		await waitFor(async () => expect(await getAllSessions()).toHaveLength(0));
	});

	it("is the only dialog on the screen", async () => {
		await seed();
		renderList();
		(await screen.findByRole("button", { name: "Delete" })).click();
		await screen.findByText("Delete this game?");

		expect(document.querySelectorAll("dialog")).toHaveLength(1);
	});
});
