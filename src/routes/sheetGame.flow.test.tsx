import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { closeDatabase, getAllSessions } from "@/lib/db";
import { loadSessions } from "@/lib/sessions";
import { overwriteGetLocale, overwriteSetLocale } from "@/paraglide/runtime";
import { routeTree } from "@/routeTree.gen";

/**
 * Checkpoint E — success criteria 4 and 6, as far as jsdom can carry them:
 * create, score a whole sheet, finish, reload, and record zero network calls.
 * The devtools half (offline from first paint, on a real origin) is task 31's.
 */
const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const PLAYERS = ["Marie", "Luc", "Dan", "Chloé"];
/** Wingspan's six categories, in template order: 4 players × 6 = 24 cells. */
const CATEGORIES = [
	"Birds",
	"Bonus cards",
	"End-of-round goals",
	"Eggs",
	"Food on cards",
	"Tucked cards",
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

/** The value this player scores in this category — every cell distinct. */
const cellValue = (category: number, player: number) =>
	category * 10 + player + 1;

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

describe("a whole sheet game, offline", () => {
	// 24 cells, each one a real IndexedDB transaction, plus a reload.
	it("creates, scores, finishes and survives a reload with no network at all", async () => {
		const first = mount();

		// --- Create -----------------------------------------------------------
		await screen.findByText("Nothing scored yet");
		tapLink(/New game/);
		await screen.findByRole("heading", { name: "Choose a game" });
		tapLink(/Wingspan/);
		await screen.findByRole("heading", { name: "Players" });

		tap("Add a player");
		tap("Add a player");
		const fields = screen.getAllByRole("textbox");
		PLAYERS.forEach((name, index) => {
			const field = fields[index];
			if (field) fireEvent.change(field, { target: { value: name } });
		});
		tap("Start scoring");

		// --- Score ------------------------------------------------------------
		await screen.findByRole("heading", { name: "Birds" });

		for (let category = 0; category < CATEGORIES.length; category += 1) {
			await screen.findByRole("heading", { name: CATEGORIES[category] });
			// Open the column on the first player, then walk it with the primary.
			tap(`${PLAYERS[0]}: not entered`);

			const isLastCategory = category === CATEGORIES.length - 1;

			for (let player = 0; player < PLAYERS.length; player += 1) {
				const value = cellValue(category, player);
				typeDigits(value);

				const next = PLAYERS[player + 1];
				if (next) {
					// The keypad never closes between players: one open surface for
					// the whole column, which is what criterion 6 is about.
					tap(new RegExp(`Next — ${next}`));
					continue;
				}

				if (isLastCategory) {
					// End of the sheet. Close the keypad on the cell itself so the
					// game can be finished from ⋯; the primary here reads
					// "See results" and is covered by the screen's own suite.
					tap(`${PLAYERS[player]}: ${value}`);
				} else {
					tap(/Next category/);
				}
			}
		}

		// Rows are still in seat order after all 24 entries.
		const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
		PLAYERS.forEach((name, index) => {
			expect(rows[index]).toContain(name);
		});

		// --- Finish -----------------------------------------------------------
		tap("More");
		tap("Finish game");
		await waitFor(async () => {
			const [stored] = await getAllSessions();
			expect(stored?.status).toBe("finished");
		});

		// --- Reload -----------------------------------------------------------
		first.unmount();
		closeDatabase();
		await loadSessions();
		mount();

		const [stored] = await getAllSessions();
		if (!stored) throw new Error("the session did not survive the reload");

		expect(stored.players.map((player) => player.name)).toEqual(PLAYERS);
		expect(stored.finishedAt).toBeDefined();

		const round = stored.rounds[0] ?? {};
		const keys = stored.categories.map((category) => category.key);
		stored.players.forEach((player, index) => {
			CATEGORIES.forEach((_, category) => {
				const key = keys[category] ?? "";
				expect(round[player.id]?.[key]).toBe(cellValue(category, index));
			});
		});

		// --- And not one request ----------------------------------------------
		expect(network.fetch).not.toHaveBeenCalled();
		expect(network.xhrOpen).not.toHaveBeenCalled();
		expect(network.socket).not.toHaveBeenCalled();
		expect(network.beacon).not.toHaveBeenCalled();
		expect(network.eventSource).not.toHaveBeenCalled();
	}, 30_000);
});
