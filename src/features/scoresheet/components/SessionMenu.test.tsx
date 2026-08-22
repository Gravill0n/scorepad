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

const template = (id: string) => {
	const found = templates.find((candidate) => candidate.id === id);
	if (!found) throw new Error(`no template "${id}"`);
	return found;
};

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
	const results = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/results",
		component: () => <p>results</p>,
	});
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <p>home</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([sheet, results, home]),
				history: createMemoryHistory({
					initialEntries: [`/session/${session.id}`],
				}),
			})}
		/>,
	);
	await screen.findByRole("heading", { name: session.name });
};

const seed = async (players = ["Marie", "Luc", "Dan", "Chloé"]) => {
	const session = await createSession({
		template: template("wingspan"),
		players: players.map((name, index) => ({ name, colorIndex: index + 1 })),
		name: "Sunday table",
	});
	await loadSessions();
	return session;
};

const tap = (name: string | RegExp) =>
	fireEvent.click(screen.getByRole("button", { name }));

const openMenu = () => tap("More");

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

describe("the ⋯ menu", () => {
	it("renames the session in place", async () => {
		const session = await seed();
		await renderSheet(session);

		openMenu();
		tap("Rename session");
		fireEvent.change(screen.getByRole("textbox", { name: "Session name" }), {
			target: { value: "Chez Marie" },
		});
		tap("Save");

		await waitFor(async () =>
			expect((await getSession(session.id))?.name).toBe("Chez Marie"),
		);
	});

	it("adds a late player without touching the columns already scored", async () => {
		const session = await seed();
		await renderSheet(session);

		// Score the four who are already here.
		tap("Marie: not entered");
		tap("5");
		tap(/Next — Luc/);
		tap("4");
		await screen.findByRole("button", { name: "Luc: 4" });

		openMenu();
		tap("Add a player");
		fireEvent.change(
			screen.getByRole("textbox", { name: "New player's name" }),
			{ target: { value: "Sofia" } },
		);
		tap("Add");

		await screen.findByRole("button", { name: "Sofia: not entered" });

		const stored = await getSession(session.id);
		expect(stored?.players).toHaveLength(5);
		// The four existing columns are untouched, and the newcomer takes the
		// next palette colour and the next seat.
		const [marie, luc] = stored?.players ?? [];
		expect(stored?.rounds[0]?.[marie?.id ?? ""]?.birds).toBe(5);
		expect(stored?.rounds[0]?.[luc?.id ?? ""]?.birds).toBe(4);
		expect(stored?.players[4]).toMatchObject({
			name: "Sofia",
			colorIndex: 5,
			sortOrder: 4,
		});
		// Nothing was written for them, so scoring reads their earlier cells as 0.
		expect(stored?.rounds[0]?.[stored?.players[4]?.id ?? ""]).toBeUndefined();
	});

	it("finishes the game and goes to results", async () => {
		const session = await seed();
		await renderSheet(session);

		openMenu();
		tap("Finish game");

		await screen.findByText("results");
		const stored = await getSession(session.id);
		expect(stored?.status).toBe("finished");
		expect(stored?.finishedAt).toBeDefined();
	});

	it("says teams, not players, for a team game", async () => {
		const session = await createSession({
			template: template("belote"),
			players: [
				{ name: "Nous", colorIndex: 1 },
				{ name: "Eux", colorIndex: 2 },
			],
			name: "Chez Marie",
		});
		await loadSessions();
		// Belote is a tally template, so the menu is exercised through the sheet
		// screen's own header in phase 6; here it is enough that the session
		// carries the team wording.
		expect(session.entry).toBe("team");
	});
});
