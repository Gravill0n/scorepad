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
import { closeDatabase, getAllSessions, getMeta } from "@/lib/db";
import {
	createSession,
	loadSessions,
	setCell,
	useSessions,
} from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import type { Session } from "@/types/session";
import type { Template } from "@/types/template";
import { ResultsScreen } from "./ResultsScreen";

const sevenWonders = templates.find((t) => t.id === "7-wonders") as Template;

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
});

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Sunday table",
	templateId: "wingspan",
	mode: "sheet",
	categories: [
		{ key: "birds", label: "Birds" },
		{ key: "eggs", label: "Eggs" },
	],
	win: "highest",
	players: [
		{ id: "p1", name: "Marie", colorIndex: 1, sortOrder: 0 },
		{ id: "p2", name: "Chloé", colorIndex: 2, sortOrder: 1 },
		{ id: "p3", name: "Émile", colorIndex: 3, sortOrder: 2 },
	],
	rounds: [
		{
			p1: { birds: 20, eggs: 10 },
			p2: { birds: 40, eggs: 25 },
			p3: { birds: 30, eggs: 12 },
		},
	],
	status: "finished",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T21:24:00.000Z",
	finishedAt: "2026-04-12T21:24:00.000Z",
	...overrides,
});

/** Reads from the store, the way the route does, so writes come back. */
const Live = ({ id }: { id: string }) => {
	const found = useSessions().find((candidate) => candidate.id === id);
	return found ? <ResultsScreen session={found} /> : <p>gone</p>;
};

const renderResults = async (value: Session | { liveId: string }) => {
	const root = createRootRoute();
	const results = createRoute({
		getParentRoute: () => root,
		path: "/session/$id/results",
		component: () => (
			<AppProvider>
				{"liveId" in value ? (
					<Live id={value.liveId} />
				) : (
					<ResultsScreen session={value} />
				)}
			</AppProvider>
		),
	});
	const home = createRoute({
		getParentRoute: () => root,
		path: "/",
		component: () => <p>home</p>,
	});
	const play = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => <p>the scoresheet</p>,
	});

	const id = "liveId" in value ? value.liveId : value.id;
	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([results, home, play]),
				history: createMemoryHistory({
					initialEntries: [`/session/${id}/results`],
				}),
			})}
		/>,
	);
	await screen.findByRole("heading", { level: 1 });
};

const rows = () =>
	screen.getAllByRole("listitem").map((row) => row.textContent ?? "");

/** The winner block, so the name in it is not confused with its ranked row. */
const winnerCard = (label: "Winner" | "Joint winners") => {
	const card = screen.getByText(label).closest("div");
	if (!card) throw new Error("no winner card");
	return within(card);
};

describe("the ranking", () => {
	it("sorts, which is the one place in the app that may", async () => {
		await renderResults(session());
		// Seat order is Marie, Chloé, Émile; the ranking is Chloé, Émile, Marie.
		expect(rows()[0]).toContain("Chloé");
		expect(rows()[1]).toContain("Émile");
		expect(rows()[2]).toContain("Marie");
	});

	it("puts the lowest total first when the template says lowest wins", async () => {
		await renderResults(session({ win: "lowest" }));
		expect(rows()[0]).toContain("Marie");
		expect(rows()[2]).toContain("Chloé");
	});

	it("names one winner and their score", async () => {
		await renderResults(session());
		expect(winnerCard("Winner").getByText("Chloé")).toBeDefined();
		expect(winnerCard("Winner").getByText("65")).toBeDefined();
	});

	it("counts teams as teams in the section head", async () => {
		await renderResults(session({ entry: "team" }));
		expect(screen.getByText("Final · 3 teams")).toBeDefined();
	});
});

describe("a tie", () => {
	const tied = session({
		templateId: "7-wonders",
		tiebreakNote: "Most coins wins.",
		rounds: [
			{
				p1: { birds: 20, eggs: 10 },
				p2: { birds: 40, eggs: 25 },
				p3: { birds: 40, eggs: 25 },
			},
		],
	});

	it("shares one winner block between both winners", async () => {
		await renderResults(tied);
		const card = winnerCard("Joint winners");
		expect(card.getByText("Chloé and Émile")).toBeDefined();
		// One block carrying one score, not a card each.
		expect(card.getAllByText("65")).toHaveLength(1);
	});

	it("gives both the same rank and marks both with =", async () => {
		await renderResults(tied);
		expect(rows()[0]).toContain("1=");
		expect(rows()[1]).toContain("1=");
		expect(rows()[2]).toContain("3");
	});

	it("states the game's rule and says out loud it will not apply it", async () => {
		await renderResults(tied);
		expect(screen.getByText("Tiebreak · 7 Wonders")).toBeDefined();
		expect(screen.getByText("Most coins wins.")).toBeDefined();
		expect(screen.getByText(/Scorepad won't decide it/)).toBeDefined();
	});

	it("offers nothing that would resolve it", async () => {
		await renderResults(tied);
		const labels = screen
			.getAllByRole("button")
			.map((button) => button.textContent ?? "");
		expect(labels.join(" ")).not.toMatch(/resolve|break|decide|coin/i);
	});

	it("shows no tiebreak card when the template carries no rule", async () => {
		await renderResults(session({ ...tied, tiebreakNote: undefined }));
		expect(screen.queryByText(/Tiebreak/)).toBeNull();
		// The tie itself is still stated.
		expect(screen.getByText("Joint winners")).toBeDefined();
	});

	it("shows no tiebreak card when the rule exists but nobody tied", async () => {
		await renderResults(session({ tiebreakNote: "Most coins wins." }));
		expect(screen.queryByText(/Tiebreak/)).toBeNull();
	});
});

describe("takeaways and warnings", () => {
	it("names who took the most categories", async () => {
		await renderResults(session());
		expect(screen.getByText("2 of 2 categories · Chloé")).toBeDefined();
	});

	it("counts hands instead for a tally game", async () => {
		await renderResults(
			session({
				mode: "tally",
				templateId: "uno",
				categories: [{ key: "points", label: "Points" }],
				rounds: [
					{ p1: { points: 60 }, p2: { points: 0 }, p3: { points: 0 } },
					{ p1: { points: 0 }, p2: { points: 44 }, p3: { points: 0 } },
				],
			}),
		);
		expect(screen.getByText("1 of 2 hands · Marie")).toBeDefined();
	});

	it("warns about empty cells without blocking anything", async () => {
		await renderResults(
			session({ rounds: [{ p1: { birds: 20 }, p2: { birds: 40 } }] }),
		);
		// 3 players × 2 categories = 6, two entered.
		expect(screen.getByText("4 cells were left empty")).toBeDefined();
		// Advisory, not a dialog and not a disabled control.
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(
			screen.getAllByRole("button").filter((b) => b.hasAttribute("disabled")),
		).toHaveLength(0);
	});

	it("says nothing about empty cells when the sheet is complete", async () => {
		await renderResults(session());
		expect(screen.queryByText(/left empty/)).toBeNull();
	});
});

describe("the footer", () => {
	const finish = async () => {
		const created = await createSession({
			template: sevenWonders,
			players: [
				{ name: "Marie", colorIndex: 1 },
				{ name: "Luc", colorIndex: 2 },
			],
		});
		await setCell(created.id, {
			playerId: created.players[0]?.id ?? "",
			categoryKey: "military",
			value: 6,
		});
		const { updateSession } = await import("@/lib/sessions");
		await updateSession(created.id, {
			status: "finished",
			finishedAt: new Date().toISOString(),
		});
		return created;
	};

	it("plays again into a new active session, leaving the finished one alone", async () => {
		const finished = await finish();
		await renderResults({ liveId: finished.id });

		fireEvent.click(screen.getByRole("button", { name: "Play again" }));
		expect(await screen.findByText("the scoresheet")).toBeDefined();

		const all = await getAllSessions();
		expect(all).toHaveLength(2);

		const copy = all.find((each) => each.id !== finished.id);
		const original = all.find((each) => each.id === finished.id);

		expect(copy?.status).toBe("active");
		// A sheet session holds exactly one round forever, so an empty sheet is
		// one empty round — not an empty array, which is the tally shape.
		expect(copy?.rounds).toEqual([{}]);
		expect(copy?.templateId).toBe("7-wonders");
		expect(copy?.players.map((p) => p.name)).toEqual(["Marie", "Luc"]);
		expect(copy?.players.map((p) => p.colorIndex)).toEqual([1, 2]);

		// The finished game is untouched — same status, same scores.
		expect(original?.status).toBe("finished");
		expect(original?.rounds[0]?.[finished.players[0]?.id ?? ""]).toEqual({
			military: 6,
		});
	});

	it("reopens in one tap, because finished is a state and not a lock", async () => {
		const finished = await finish();
		await renderResults({ liveId: finished.id });

		fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
		expect(await screen.findByText("the scoresheet")).toBeDefined();

		await waitFor(async () => {
			const [stored] = await getAllSessions();
			expect(stored?.status).toBe("active");
			expect(stored?.finishedAt).toBeUndefined();
		});
		// Reopening keeps the scores; it is an undo of finishing, not of playing.
		const [stored] = await getAllSessions();
		expect(stored?.rounds[0]?.[finished.players[0]?.id ?? ""]).toEqual({
			military: 6,
		});
	});

	it("exports this game without claiming the whole phone is backed up", async () => {
		const finished = await finish();
		await renderResults({ liveId: finished.id });

		const click = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => undefined);
		vi.stubGlobal("URL", {
			...URL,
			createObjectURL: () => "blob:x",
			revokeObjectURL: () => undefined,
		});

		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		expect(click).toHaveBeenCalled();

		// Home's stale-backup warning must not be silenced by one game.
		expect(await getMeta("lastExportedAt")).toBeUndefined();
		click.mockRestore();
		vi.unstubAllGlobals();
	});

	it("goes back to the shelf", async () => {
		await renderResults(session());
		fireEvent.click(screen.getByRole("button", { name: "Back to games" }));
		expect(await screen.findByText("home")).toBeDefined();
	});
});

describe("reached mid-game from the sheet", () => {
	/**
	 * `See results →` on the last category opens this screen without finishing
	 * the game — deliberately, because passing a target never ends one.
	 */
	const midGame = session({ status: "active", finishedAt: undefined });

	it("names the table instead of a finish time it does not have", async () => {
		await renderResults(midGame);
		expect(screen.getByText("Wingspan · 3 players")).toBeDefined();
		expect(screen.queryByText(/finished/)).toBeNull();
	});

	it("still ranks, because that is what the screen is for", async () => {
		await renderResults(midGame);
		expect(rows()[0]).toContain("Chloé");
	});
});
