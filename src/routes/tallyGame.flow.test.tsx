import {
	createMemoryHistory,
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
import { closeDatabase, getAllSessions } from "@/lib/db";
import { loadSessions } from "@/lib/sessions";
import { overwriteGetLocale, overwriteSetLocale } from "@/paraglide/runtime";
import { routeTree } from "@/routeTree.gen";

/**
 * Checkpoint F — a tally evening through the real route tree: create a
 * ten-player Uno table, play four hands through the entry sheet, correct one
 * from hand history, finish, reload, and record zero network calls.
 *
 * The layout half of the checkpoint (no scroll on the standings at ten, no
 * dialog anywhere) is task 32's — jsdom has no layout engine.
 */
const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const PLAYERS = [
	"Marie",
	"Luc",
	"Sofia",
	"Tom",
	"Chloé",
	"Émile",
	"Dan",
	"Ana",
	"Ben",
	"Zoé",
];

/** Uno: one player banks the hand, everyone else takes nothing. */
const HANDS = [
	{ winner: 0, points: 42 },
	{ winner: 3, points: 66 },
	{ winner: 7, points: 51 },
	{ winner: 3, points: 38 },
];

const network = {
	fetch: vi.fn(),
	xhrOpen: vi.fn(),
	socket: vi.fn(),
	beacon: vi.fn(),
	eventSource: vi.fn(),
};

const stubTheNetwork = () => {
	vi.stubGlobal("fetch", network.fetch);
	vi.stubGlobal("sendBeacon", network.beacon);
	vi.stubGlobal(
		"XMLHttpRequest",
		class {
			open = network.xhrOpen;
			send = vi.fn();
			setRequestHeader = vi.fn();
			addEventListener = vi.fn();
		},
	);
	vi.stubGlobal(
		"WebSocket",
		class {
			constructor(url: string) {
				network.socket(url);
			}
		},
	);
	vi.stubGlobal(
		"EventSource",
		class {
			constructor(url: string) {
				network.eventSource(url);
			}
		},
	);
};

const mount = () => {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	return { router, ...render(<RouterProvider router={router} />) };
};

const tap = (name: string | RegExp) =>
	fireEvent.click(screen.getByRole("button", { name }));

const tapLink = (name: string | RegExp) =>
	fireEvent.click(screen.getByRole("link", { name }));

const typeDigits = (value: number) => {
	for (const digit of String(value)) tap(digit);
};

/**
 * The sheet waits for its exit animation before it leaves the tree, and jsdom
 * runs no animations — so a test has to report the one that would have played.
 */
const settleSheet = () => {
	const panel = document.querySelector("dialog [class*='rounded-t-card']");
	if (panel) fireEvent.animationEnd(panel);
};

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
	for (const spy of Object.values(network)) spy.mockClear();
	overwriteGetLocale(() => "en");
	overwriteSetLocale(() => undefined);
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
	stubTheNetwork();
});

afterEach(() => vi.unstubAllGlobals());

describe("a whole tally evening, offline", () => {
	it("creates, plays four hands, corrects one, finishes and survives a reload", async () => {
		const first = mount();

		// --- Create -----------------------------------------------------------
		await screen.findByText("Nothing scored yet");
		tapLink(/New game/);
		await screen.findByRole("heading", { name: "Choose a game" });
		tapLink(/Uno/);
		await screen.findByRole("heading", { name: "Players" });

		// Uno opens with two rows; a ten-player table needs eight more.
		for (let index = 2; index < PLAYERS.length; index += 1) {
			tap("Add a player");
		}
		const fields = screen.getAllByRole("textbox");
		PLAYERS.forEach((name, index) => {
			const field = fields[index];
			if (field) fireEvent.change(field, { target: { value: name } });
		});
		tap("Start scoring");

		// --- Play ---------------------------------------------------------------
		await screen.findByRole("button", { name: /Enter hand 1/ });

		for (const [index, hand] of HANDS.entries()) {
			tap(new RegExp(`Enter hand ${index + 1}`));
			await screen.findByRole("heading", { name: PLAYERS[0] ?? "" });

			for (let seat = 0; seat < PLAYERS.length; seat += 1) {
				// One sheet walks the whole table: it never closes between players.
				expect(screen.getAllByRole("dialog")).toHaveLength(1);
				typeDigits(seat === hand.winner ? hand.points : 0);

				const next = PLAYERS[seat + 1];
				if (next) tap(new RegExp(`Next — ${next}`));
				else tap(/Done/);
			}
			settleSheet();

			// Back on the standings, with the hand recapped.
			await screen.findByText(
				`Hand ${index + 1} · ${PLAYERS[hand.winner]} took ${hand.points}`,
			);
		}

		// Rows are in seat order even though seat 4 leads on 104.
		const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
		PLAYERS.forEach((name, index) => {
			expect(rows[index]).toContain(name);
		});
		// Tom banked 66 + 38, Ben 51, Marie 42 — and every one of them is still
		// in the seat they started in.
		expect(rows[3]).toContain("Rank 1st");
		expect(rows[7]).toContain("Rank 2nd");
		expect(rows[0]).toContain("Rank 3rd");

		// --- Correct a hand from the ledger -------------------------------------
		tap("More");
		tap("Hand history");
		await screen.findByRole("heading", { name: "Hand history" });

		const handThree = screen.getAllByRole("row")[3];
		if (!handThree) throw new Error("no hand 3 row");
		fireEvent.click(
			within(handThree).getByRole("button", { name: String(HANDS[2]?.points) }),
		);
		await screen.findByRole("heading", { name: PLAYERS[7] ?? "" });
		// 51 was really 15. The correction is on disk the moment it is typed —
		// the sheet has no save action — so closing it is the whole gesture.
		tap("Clear");
		typeDigits(15);
		tap("Close");
		settleSheet();

		await waitFor(async () => {
			const [stored] = await getAllSessions();
			const ben = stored?.players[7]?.id ?? "";
			expect(stored?.rounds[2]?.[ben]).toEqual({ points: 15 });
		});

		// --- Finish -------------------------------------------------------------
		tapLink("Close");
		await screen.findByRole("button", { name: /Enter hand 5/ });
		tap("More");
		tap("Finish game");
		await waitFor(async () => {
			const [stored] = await getAllSessions();
			expect(stored?.status).toBe("finished");
		});

		// --- Reload -------------------------------------------------------------
		first.unmount();
		closeDatabase();
		await loadSessions();
		mount();

		const [stored] = await getAllSessions();
		if (!stored) throw new Error("the session did not survive the reload");

		expect(stored.mode).toBe("tally");
		expect(stored.players.map((player) => player.name)).toEqual(PLAYERS);
		expect(stored.rounds).toHaveLength(HANDS.length);
		expect(stored.finishedAt).toBeDefined();

		// Every hand, exactly as it was entered — one banker, and nobody else
		// stored as anything but the zero they typed.
		HANDS.forEach((hand, index) => {
			const corrected = index === 2 ? 15 : hand.points;
			stored.players.forEach((player, seat) => {
				expect(stored.rounds[index]?.[player.id]).toEqual({
					points: seat === hand.winner ? corrected : 0,
				});
			});
		});

		// --- And not one request ------------------------------------------------
		expect(network.fetch).not.toHaveBeenCalled();
		expect(network.xhrOpen).not.toHaveBeenCalled();
		expect(network.socket).not.toHaveBeenCalled();
		expect(network.beacon).not.toHaveBeenCalled();
		expect(network.eventSource).not.toHaveBeenCalled();
	}, 60_000);
});
