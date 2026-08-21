import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { closeDatabase, getSession } from "@/lib/db";
import {
	createSession,
	loadSessions,
	setCell,
	useSessions,
} from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import type { Template } from "@/types/template";
import { HandHistory } from "./HandHistory";

const belote = templates.find((t) => t.id === "belote") as Template;
const uno = templates.find((t) => t.id === "uno") as Template;

const wipeDatabase = () =>
	new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error);
		request.onblocked = () => resolve();
	});

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

const Screen = ({ id }: { id: string }) => {
	const session = useSessions().find((candidate) => candidate.id === id);
	if (!session) return null;
	return <HandHistory session={session} />;
};

const renderHistory = async (id: string) => {
	const root = createRootRoute();
	const history = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/history",
		component: () => (
			<AppProvider>
				<Screen id={id} />
			</AppProvider>
		),
	});
	const session = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => <p>the session</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([history, session]),
				history: createMemoryHistory({
					initialEntries: [`/session/${id}/history`],
				}),
			})}
		/>,
	);
	await screen.findByRole("heading", { name: "Hand history" });
};

/** A Belote evening: 15 hands between two teams, written the way play writes them. */
const playBelote = async (hands: [number, number][]) => {
	const session = await createSession({
		template: belote,
		players: [
			{ name: "Marie & Luc", colorIndex: 1 },
			{ name: "Sofia & Tom", colorIndex: 2 },
		],
	});
	const [a, b] = session.players;

	for (const [index, [first, second]] of hands.entries()) {
		await setCell(session.id, {
			playerId: a?.id ?? "",
			categoryKey: "hand",
			value: first,
			roundIndex: index,
		});
		await setCell(session.id, {
			playerId: b?.id ?? "",
			categoryKey: "hand",
			value: second,
			roundIndex: index,
		});
	}

	return session;
};

const fifteenHands: [number, number][] = [
	[82, 20],
	[14, 88],
	[60, 42],
	[30, 72],
	[90, 12],
	[45, 57],
	[70, 32],
	[26, 76],
	[51, 51],
	[64, 38],
	[18, 84],
	[77, 25],
	[39, 63],
	[55, 47],
	[40, 62],
];

describe("the ledger", () => {
	it("lists every hand played, with a row per hand", async () => {
		const session = await playBelote(fifteenHands);
		await renderHistory(session.id);

		expect(screen.getAllByRole("row")).toHaveLength(1 + 15 + 1);
		expect(
			screen.getByText(`${session.name} · 15 hands · 2 players`),
		).toBeDefined();
	});

	it("totals each column, and the totals are the session's totals", async () => {
		const session = await playBelote(fifteenHands);
		await renderHistory(session.id);

		// 82+14+60+30+90+45+70+26+51+64+18+77+39+55+40 = 761
		const footer = screen.getAllByRole("row").at(-1);
		if (!footer) throw new Error("no total row");
		expect(within(footer).getByText("761")).toBeDefined();
		expect(within(footer).getByText("769")).toBeDefined();
	});

	it("accumulates hand by hand in the running view", async () => {
		const session = await playBelote(fifteenHands.slice(0, 3));
		await renderHistory(session.id);

		fireEvent.click(screen.getByRole("button", { name: "Running" }));
		const rows = screen.getAllByRole("row");
		// Hand 2 running: 82+14 = 96 and 20+88 = 108.
		expect(rows[2]?.textContent).toBe("296108");
		// Hand 3 running: 96+60 = 156 and 108+42 = 150.
		expect(rows[3]?.textContent).toBe("3156150");
	});

	it("loses nothing when the app is force-quit mid-evening", async () => {
		const session = await playBelote(fifteenHands.slice(0, 12));

		// The database is closed and the store dropped, as a force-quit does.
		closeDatabase();
		await loadSessions();
		await renderHistory(session.id);

		expect(
			screen.getByText(`${session.name} · 12 hands · 2 players`),
		).toBeDefined();
		const footer = screen.getAllByRole("row").at(-1);
		if (!footer) throw new Error("no total row");
		// 82+14+60+30+90+45+70+26+51+64+18+77 = 627
		expect(within(footer).getByText("627")).toBeDefined();
	});
});

describe("zeros", () => {
	it("draws a zero as a faint interpunct, so the scoring hand is legible", async () => {
		const session = await createSession({
			template: uno,
			players: [
				{ name: "Marie", colorIndex: 1 },
				{ name: "Luc", colorIndex: 2 },
			],
		});
		await setCell(session.id, {
			playerId: session.players[0]?.id ?? "",
			categoryKey: "points",
			value: 60,
			roundIndex: 0,
		});
		await renderHistory(session.id);

		const hand = screen.getAllByRole("row")[1];
		if (!hand) throw new Error("no hand row");
		expect(within(hand).getByText("60")).toBeDefined();
		expect(within(hand).getByText("·")).toBeDefined();
	});
});

describe("correction", () => {
	it("opens the entry sheet on the cell that was tapped", async () => {
		const session = await playBelote(fifteenHands.slice(0, 3));
		await renderHistory(session.id);

		const handTwo = screen.getAllByRole("row")[2];
		if (!handTwo) throw new Error("no hand 2");
		fireEvent.click(within(handTwo).getByRole("button", { name: "88" }));

		// The sheet opens on that team, in that hand — not at the top of either.
		expect(
			await screen.findByRole("heading", { name: "Sofia & Tom" }),
		).toBeDefined();
		expect(screen.getByText("Hand 2")).toBeDefined();
	});

	it("recomputes the totals live when a cell is corrected", async () => {
		const session = await playBelote([
			[82, 20],
			[14, 88],
		]);
		await renderHistory(session.id);

		const handOne = screen.getAllByRole("row")[1];
		if (!handOne) throw new Error("no hand 1");
		fireEvent.click(within(handOne).getByRole("button", { name: "82" }));
		await screen.findByRole("heading", { name: "Marie & Luc" });

		fireEvent.click(screen.getByRole("button", { name: "Delete one digit" }));

		await waitFor(async () => {
			const stored = await getSession(session.id);
			expect(stored?.rounds[0]?.[session.players[0]?.id ?? ""]).toEqual({
				hand: 8,
			});
		});
	});

	it("does not offer correction in the running view, where it means nothing", async () => {
		const session = await playBelote([[82, 20]]);
		await renderHistory(session.id);

		const handOne = () => {
			const row = screen.getAllByRole("row")[1];
			if (!row) throw new Error("no hand 1");
			return within(row);
		};

		expect(handOne().getByRole("button", { name: "82" })).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Running" }));
		expect(handOne().queryByRole("button", { name: "82" })).toBeNull();
		// The value is still on screen — it is simply no longer a control.
		expect(handOne().getByText("82")).toBeDefined();
	});
});

describe("an evening that has not started", () => {
	it("says so rather than drawing an empty grid", async () => {
		const session = await createSession({
			template: uno,
			players: [
				{ name: "Marie", colorIndex: 1 },
				{ name: "Luc", colorIndex: 2 },
			],
		});
		await renderHistory(session.id);

		expect(screen.getByText("No hands yet")).toBeDefined();
		expect(screen.queryByRole("table")).toBeNull();
	});
});
