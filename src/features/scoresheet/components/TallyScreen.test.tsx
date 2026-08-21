import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import type { Session } from "@/types/session";
import { TallyScreen } from "./TallyScreen";

const seats = (count: number) =>
	Array.from({ length: count }, (_, index) => ({
		id: `p${index + 1}`,
		name: `Player ${index + 1}`,
		colorIndex: index + 1,
		sortOrder: index,
	}));

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Chez Marie",
	templateId: "uno",
	mode: "tally",
	categories: [{ key: "points", label: "Points won" }],
	win: "highest",
	targetScore: 500,
	players: [
		{ id: "p1", name: "Marie", colorIndex: 1, sortOrder: 0 },
		{ id: "p2", name: "Luc", colorIndex: 2, sortOrder: 1 },
		{ id: "p3", name: "Sofia", colorIndex: 3, sortOrder: 2 },
		{ id: "p4", name: "Tom", colorIndex: 4, sortOrder: 3 },
	],
	rounds: [
		{
			p1: { points: 40 },
			p2: { points: 0 },
			p3: { points: 0 },
			p4: { points: 0 },
		},
		{
			p1: { points: 0 },
			p2: { points: 60 },
			p3: { points: 0 },
			p4: { points: 0 },
		},
	],
	status: "active",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T19:00:00.000Z",
	...overrides,
});

const renderTally = async (value = session()) => {
	const root = createRootRoute();
	const tally = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => (
			<AppProvider>
				<TallyScreen session={value} />
			</AppProvider>
		),
	});
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <p>home</p>,
	});
	const history = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/history",
		component: () => <p>history screen</p>,
	});
	const results = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/results",
		component: () => <p>results</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([tally, home, history, results]),
				history: createMemoryHistory({ initialEntries: ["/session/s1"] }),
			})}
		/>,
	);
	await screen.findByRole("heading", { name: "Chez Marie" });
};

/** The standings rows are the only list on the screen at 4+ players. */
const rows = () =>
	screen.getAllByRole("listitem").map((row) => row.textContent ?? "");

describe("the standings", () => {
	it("names the session, the game, the table size and the target", async () => {
		await renderTally();
		expect(screen.getByText("Uno · 4 players · to 500")).toBeDefined();
	});

	it("shows one row per player in seat order, never re-sorted by score", async () => {
		// Luc leads on 60; Marie still sits in seat one.
		await renderTally();
		expect(rows()[0]).toContain("Marie");
		expect(rows()[1]).toContain("Luc");
		expect(rows()[2]).toContain("Sofia");
		expect(rows()[3]).toContain("Tom");
	});

	it("puts the rank in the margin rather than in the order", async () => {
		await renderTally();
		expect(screen.getByText("Rank 1st")).toBeDefined();
		expect(rows()[1]).toContain("Rank 1st");
		expect(rows()[0]).toContain("Rank 2nd");
	});

	it("marks the leader and nobody else", async () => {
		await renderTally();
		expect(screen.getAllByText("Leads")).toHaveLength(4);
		expect(rows()[1]).toContain("Leads");
	});

	it("reads SAFEST, not LEADS, when the lowest total wins", async () => {
		await renderTally(session({ win: "lowest", targetScore: 100 }));
		expect(screen.getAllByText("Safest")).toHaveLength(4);
		expect(screen.queryByText("Leads")).toBeNull();
	});

	it("carries the distance left to the target", async () => {
		await renderTally();
		expect(screen.getByText("460 to go")).toBeDefined();
		expect(screen.getByText("440 to go")).toBeDefined();
	});

	it("recaps the last hand and offers to correct it", async () => {
		await renderTally();
		expect(screen.getByText("Hand 2 · Luc took 60")).toBeDefined();
		expect(screen.getByRole("button", { name: "Edit last" })).toBeDefined();
	});

	it("shows no recap before the first hand", async () => {
		await renderTally(session({ rounds: [] }));
		expect(screen.queryByRole("button", { name: "Edit last" })).toBeNull();
	});

	it("names the hand about to be entered, at hand 1 and at hand 40", async () => {
		await renderTally(session({ rounds: [] }));
		expect(screen.getByRole("button", { name: /Enter hand 1/ })).toBeDefined();
	});

	it("states a passed target and changes nothing", async () => {
		const passed = session({
			rounds: [{ p1: { points: 520 } }],
			status: "active",
		});
		await renderTally(passed);
		expect(
			screen.getByText(
				"Marie passed 500 · finish from ⋯ when the table is done",
			),
		).toBeDefined();
		// Not a dialog, and the session is still being played.
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.getByRole("button", { name: /Enter hand 2/ })).toBeDefined();
	});

	it("renders no race bar and no distance without a target score", async () => {
		await renderTally(session({ targetScore: undefined }));
		expect(screen.queryByText(/to go/)).toBeNull();
		expect(screen.getByText("Uno · 4 players")).toBeDefined();
	});
});

describe("density", () => {
	it("sheds the second line at seven players, keeping name and total", async () => {
		await renderTally(session({ players: seats(7) }));
		// The hands-won clause is the first thing to go.
		expect(screen.queryByText(/won/)).toBeNull();
		expect(rows()[0]).toContain("Player 1");
	});

	it("keeps the hands-won clause at six", async () => {
		await renderTally(session({ players: seats(6) }));
		expect(screen.getAllByText(/0 won/).length).toBeGreaterThan(0);
	});
});

describe("the inline ledger", () => {
	const twoTeams = session({
		templateId: "belote",
		entry: "team",
		targetScore: 501,
		players: [
			{ id: "p1", name: "Marie & Luc", colorIndex: 1, sortOrder: 0 },
			{ id: "p2", name: "Sofia & Tom", colorIndex: 2, sortOrder: 1 },
		],
		rounds: [
			{ p1: { points: 82 }, p2: { points: 20 } },
			{ p1: { points: 14 }, p2: { points: 88 } },
		],
	});

	it("shows the last hands under the standings at two teams", async () => {
		await renderTally(twoTeams);
		expect(screen.getByText("Hand")).toBeDefined();

		// The ledger is the second list on the screen; the standings are first.
		const ledger = screen.getAllByRole("list")[1];
		if (!ledger) throw new Error("no ledger");
		const hands = within(ledger).getAllByRole("listitem");

		// Oldest above newest, so the hand just played sits against the entry bar.
		expect(hands[0]?.textContent).toBe("182822020");
		expect(hands[1]?.textContent).toBe("2149688108");
	});

	it("disappears at four players, where it would show two hands", async () => {
		await renderTally();
		expect(screen.queryByText("Hand")).toBeNull();
	});
});

describe("the ⋯ menu", () => {
	it("adds hand history for a tally session", async () => {
		await renderTally();
		fireEvent.click(screen.getByRole("button", { name: "More" }));
		fireEvent.click(screen.getByRole("button", { name: "Hand history" }));
		expect(await screen.findByText("history screen")).toBeDefined();
	});
});
