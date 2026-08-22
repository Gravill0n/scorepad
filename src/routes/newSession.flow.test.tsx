import {
	createMemoryHistory,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { closeDatabase, getAllSessions, getMeta, putMeta } from "@/lib/db";
import { overwriteGetLocale, overwriteSetLocale } from "@/paraglide/runtime";
import { routeTree } from "@/routeTree.gen";

/**
 * Checkpoint D: Home → picker → setup → a persisted session, offline, in
 * French. One walk through the real route tree, not three component tests.
 */
const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

let locale: "en" | "fr" = "fr";

const walkTheApp = () => {
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	render(<RouterProvider router={router} />);
	return router;
};

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	locale = "fr";
	overwriteGetLocale(() => locale);
	overwriteSetLocale((next: string) => {
		locale = next === "fr" ? "fr" : "en";
	});
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => vi.unstubAllGlobals());

describe("starting a game, in French, offline", () => {
	it("goes Home → picker → setup → a session that outlives a reload", async () => {
		await putMeta("locale", "fr");
		const router = walkTheApp();

		// Home, first run (1e).
		await screen.findByText("Rien de marqué");
		fireEvent.click(screen.getByRole("link", { name: /Nouvelle partie/ }));

		// The shelf (1f), counting its own games.
		await screen.findByRole("heading", { name: "Choisir un jeu" });
		expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe(
			"Filtrer les 11 jeux",
		);

		// A team game, so the walk covers 1i's shape as well as 1h's.
		fireEvent.click(screen.getByRole("link", { name: /Belote/ }));

		// Setup (1h/1i), in French, with the team wording.
		await screen.findByRole("heading", { name: "Équipes" });
		expect(screen.getByText("Belote · exactement 2 équipes")).toBeDefined();

		// Blocked, stated twice, in French.
		const start = screen.getByRole("button", { name: "Commencer la partie" });
		expect((start as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole("alert").textContent).toContain(
			"Chaque équipe doit avoir un nom.",
		);

		const [first, second] = screen.getAllByRole("textbox");
		fireEvent.change(first as HTMLInputElement, {
			target: { value: "Marie & Luc" },
		});
		fireEvent.change(second as HTMLInputElement, {
			target: { value: "Marie & Luc" },
		});

		// 1i exactly: two teams, one name.
		expect(screen.getByRole("alert").textContent).toContain(
			"Deux équipes portent le même nom. Renommez-en une pour continuer.",
		);
		expect((start as HTMLButtonElement).disabled).toBe(true);

		fireEvent.change(second as HTMLInputElement, {
			target: { value: "Sofia & Tom" },
		});
		expect(screen.queryByRole("alert")).toBeNull();
		expect((start as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(start);

		// The session exists, on this phone, with the template snapshotted.
		await waitFor(() =>
			expect(router.state.location.pathname).toMatch(/^\/session\//),
		);
		const [session] = await getAllSessions();
		expect(session?.templateId).toBe("belote");
		expect(session?.players.map((player) => player.name)).toEqual([
			"Marie & Luc",
			"Sofia & Tom",
		]);
		expect(session?.players.map((player) => player.colorIndex)).toEqual([1, 2]);
		expect(session?.categories).toEqual([
			{
				key: "hand",
				label: "Hand points",
				hint: "Card points, declarations and 10 de der combined",
			},
		]);
		expect(session?.targetScore).toBe(501);
		expect(session?.status).toBe("active");
		// Named in French, because that is the locale it was created in.
		expect(session?.name).toMatch(/^Belote /);

		// The names come back as pills next time.
		expect(await getMeta("recentNames")).toEqual([
			"Marie & Luc",
			"Sofia & Tom",
		]);
	});

	it("touches the network zero times on the way", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const open = vi.fn();
		vi.stubGlobal(
			"XMLHttpRequest",
			class {
				open = open;
				send = vi.fn();
				setRequestHeader = vi.fn();
				addEventListener = vi.fn();
			},
		);

		walkTheApp();
		await screen.findByText("Rien de marqué");
		fireEvent.click(screen.getByRole("link", { name: /Nouvelle partie/ }));
		await screen.findByRole("heading", { name: "Choisir un jeu" });
		fireEvent.click(screen.getByRole("link", { name: /Wingspan/ }));
		await screen.findByRole("heading", { name: "Joueurs" });

		const [first, second] = screen.getAllByRole("textbox");
		fireEvent.change(first as HTMLInputElement, { target: { value: "Marie" } });
		fireEvent.change(second as HTMLInputElement, { target: { value: "Luc" } });
		fireEvent.click(
			screen.getByRole("button", { name: "Commencer la partie" }),
		);

		await waitFor(async () => expect(await getAllSessions()).toHaveLength(1));
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(open).not.toHaveBeenCalled();
	});
});
