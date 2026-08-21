import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { closeDatabase, getSession } from "@/lib/db";
import { createSession, loadSessions, useSessions } from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import type { Session } from "@/types/session";
import { SheetScreen } from "./SheetScreen";

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const wingspan = () => {
	const template = templates.find((candidate) => candidate.id === "wingspan");
	if (!template) throw new Error("no wingspan template");
	return template;
};

/** Re-renders from the store, the way the route does, so writes come back. */
const Screen = ({ id }: { id: string }) => {
	const session = useSessions().find((candidate) => candidate.id === id);
	return session ? <SheetScreen session={session} /> : <p>gone</p>;
};

const renderSheet = async (session: Session) => {
	const root = createRootRoute();
	const sheet = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => (
			<AppProvider>
				<Screen id={session.id} />
			</AppProvider>
		),
	});
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <p>home</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([sheet, home]),
				history: createMemoryHistory({
					initialEntries: [`/session/${session.id}`],
				}),
			})}
		/>,
	);
	await screen.findByRole("heading", { name: session.name });
};

const seed = async () => {
	const session = await createSession({
		template: wingspan(),
		players: [
			{ name: "Marie", colorIndex: 1 },
			{ name: "Luc", colorIndex: 2 },
			{ name: "Dan", colorIndex: 3 },
		],
		name: "Sunday table",
	});
	await loadSessions();
	return session;
};

const tap = (name: string | RegExp) =>
	fireEvent.click(screen.getByRole("button", { name }));

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

describe("entering a score", () => {
	it("opens the keypad on the player whose cell was tapped", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		expect(
			screen.getByRole("button", { name: "Positive or negative" }),
		).toBeDefined();
		// The panel names whose number this is, and who is next.
		expect(screen.getByRole("button", { name: /Next — Luc/ })).toBeDefined();
	});

	it("persists every keystroke, with no save action anywhere", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		tap("1");
		tap("2");

		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(stored?.rounds[0]?.[session.players[0]?.id ?? ""]?.birds).toBe(12);
		});
		expect(screen.queryByRole("button", { name: /Save/i })).toBeNull();
	});

	it("recomputes the running total without moving the row", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		tap("9");

		await waitFor(() =>
			expect(screen.getAllByRole("listitem")[0]?.textContent).toContain(
				"9 so far",
			),
		);
		// Marie leads now and is still in seat one.
		expect(screen.getAllByRole("listitem")[0]?.textContent).toContain("Marie");
		expect(screen.getAllByRole("listitem")[0]?.textContent).toContain("1st");
	});

	it("walks the column, then hands over to the next category", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		tap("5");
		tap(/Next — Luc/);
		tap("4");
		tap(/Next — Dan/);
		tap("3");

		// Last player in the column: the primary names the next category.
		tap(/Next category/);
		await screen.findByRole("heading", { name: "Bonus cards" });
	});

	it("clears a cell back to empty rather than to zero", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		tap("7");
		await screen.findByRole("button", { name: "Marie: 7" });

		tap("Clear");

		await screen.findByRole("button", { name: "Marie: not entered" });
		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(
				stored?.rounds[0]?.[session.players[0]?.id ?? ""]?.birds,
			).toBeUndefined();
		});
	});

	it("keeps a typed zero, which is not an empty cell", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		tap("0");

		await screen.findByRole("button", { name: "Marie: 0" });
		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(stored?.rounds[0]?.[session.players[0]?.id ?? ""]?.birds).toBe(0);
		});
	});

	it("closes the keypad when the focused cell is tapped again", async () => {
		const session = await seed();
		await renderSheet(session);

		tap("Marie: not entered");
		tap("Marie: not entered");
		expect(
			screen.queryByRole("button", { name: "Positive or negative" }),
		).toBeNull();
	});
});
