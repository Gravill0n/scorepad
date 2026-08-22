import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import type { Session } from "@/types/session";
import { SessionList } from "./SessionList";

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Chez Marie",
	templateId: "belote",
	mode: "tally",
	categories: [{ key: "hand", label: "Hand points" }],
	win: "highest",
	targetScore: 501,
	players: [
		{ id: "p1", name: "Nous", colorIndex: 1, sortOrder: 0 },
		{ id: "p2", name: "Eux", colorIndex: 2, sortOrder: 1 },
	],
	rounds: [{ p1: { hand: 512 }, p2: { hand: 468 } }],
	status: "active",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T19:00:00.000Z",
	...overrides,
});

const renderList = (sessions: Session[]) => {
	const root = createRootRoute();
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => (
			<AppProvider>
				<SessionList sessions={sessions} />
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

beforeEach(() => {
	vi.stubGlobal("matchMedia", () => ({
		matches: false,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("an in-progress row", () => {
	it("names the game and badges its mode", async () => {
		renderList([session()]);
		expect(await screen.findByText("Belote")).toBeDefined();
		expect(screen.getByText("Tally")).toBeDefined();
	});

	it("carries the session name and how far along it is", async () => {
		renderList([session({ rounds: Array.from({ length: 13 }, () => ({})) })]);
		expect(await screen.findByText(/Chez Marie · hand 14/)).toBeDefined();
	});

	it("shows the standing in seat order with the target beside it", async () => {
		renderList([session()]);
		expect(await screen.findByText(/512 – 468/)).toBeDefined();
		expect(screen.getByText("of 501")).toBeDefined();
	});

	it("omits the target when the template has none", async () => {
		const noTarget = session();
		delete noTarget.targetScore;
		renderList([noTarget]);
		await screen.findByText(/512 – 468/);
		expect(screen.queryByText(/^of /)).toBeNull();
	});

	it("gives the recomputing figure tabular numerals", async () => {
		renderList([session()]);
		const standing = await screen.findByText(/512 – 468/);
		expect(standing.className).toContain("num");
	});

	it("resumes into the scoresheet", async () => {
		renderList([session()]);
		// Named, not the only link on the screen: the footer's `New game` is a
		// link too, and a bare byRole("link") would match both.
		const link = await screen.findByRole("link", { name: /Resume/ });
		expect(link.getAttribute("href")).toBe("/session/s1");
	});
});

describe("a finished row", () => {
	const finished = session({
		id: "s2",
		name: "Camping",
		templateId: "uno",
		status: "finished",
		rounds: [{ p1: { hand: 300 }, p2: { hand: 512 } }],
	});

	it("opens Results rather than the scoresheet", async () => {
		renderList([finished]);
		const link = await screen.findByRole("link", { name: /Camping/ });
		expect(link.getAttribute("href")).toBe("/session/s2/results");
	});

	it("names the winner and the winning score", async () => {
		renderList([finished]);
		expect(await screen.findByText(/Camping · Eux won · 512/)).toBeDefined();
	});

	it("names every winner when the game ended tied", async () => {
		const tied = session({
			id: "s3",
			status: "finished",
			rounds: [{ p1: { hand: 300 }, p2: { hand: 300 } }],
		});
		renderList([tied]);
		expect(await screen.findByText(/Nous & Eux tied/)).toBeDefined();
	});
});

describe("the list", () => {
	const older = session({
		id: "a",
		name: "Older",
		updatedAt: "2026-04-10T10:00:00.000Z",
	});
	const newer = session({
		id: "b",
		name: "Newer",
		updatedAt: "2026-04-12T10:00:00.000Z",
	});

	it("puts the most recently touched session first", async () => {
		renderList([older, newer]);
		await screen.findByText(/Newer/);
		const rows = screen.getAllByRole("link");
		expect(rows[0]?.textContent).toContain("Newer");
		expect(rows[1]?.textContent).toContain("Older");
	});

	it("is not re-sorted by name or by game", async () => {
		// "Older" sorts before "Newer" alphabetically; recency has to win.
		renderList([newer, older]);
		await screen.findByText(/Newer/);
		expect(screen.getAllByRole("link")[0]?.textContent).toContain("Newer");
	});

	it("separates in progress from finished, and counts the finished", async () => {
		renderList([session(), session({ id: "s2", status: "finished" })]);
		expect(await screen.findByText("In progress")).toBeDefined();
		expect(screen.getByText("Finished · 1")).toBeDefined();
	});

	it("shows no finished heading when nothing is finished", async () => {
		renderList([session()]);
		await screen.findByText("In progress");
		expect(screen.queryByText(/^Finished/)).toBeNull();
	});

	it("is the only scrolling surface on the screen", async () => {
		const { container } = renderList([session()]);
		await screen.findByText("In progress");

		const scrollers = container.querySelectorAll(
			'[class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-scroll"]',
		);
		expect(scrollers).toHaveLength(1);
	});

	it("does not sort the store's frozen array in place", async () => {
		const frozen = Object.freeze([older, newer]) as Session[];
		expect(() => renderList(frozen)).not.toThrow();
		expect(await screen.findByText(/Newer/)).toBeDefined();
	});
});
