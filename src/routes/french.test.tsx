import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { AppProvider } from "@/app/provider";
import { EntrySheet } from "@/features/scoresheet/components/EntrySheet";
import { HandHistory } from "@/features/scoresheet/components/HandHistory";
import { ResultsScreen } from "@/features/scoresheet/components/ResultsScreen";
import { SheetScreen } from "@/features/scoresheet/components/SheetScreen";
import { TallyScreen } from "@/features/scoresheet/components/TallyScreen";
import { GameShelf } from "@/features/sessions/components/GameShelf";
import { PlayerSetup } from "@/features/sessions/components/PlayerSetup";
import { closeDatabase } from "@/lib/db";
import { loadSessions } from "@/lib/sessions";
import { templates } from "@/lib/templates/registry";
import { overwriteGetLocale, overwriteSetLocale } from "@/paraglide/runtime";
import type { Session } from "@/types/session";
import type { Template } from "@/types/template";

/**
 * Task 29's layout audit: **every screen rendered in French at its worst-case
 * player count.**
 *
 * jsdom has no layout engine, so this asserts what it can — that the French
 * copy is what actually reaches the screen, at the player counts where a
 * container is tightest. A component that hardcoded English, or a message key
 * missing from `fr.json`, fails here. The 390 × 844 measurement is task 32's,
 * with a real viewport.
 */
const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const template = (id: string) =>
	templates.find((each) => each.id === id) as Template;

/** The longest French names a real table produces, not "Player 1". */
const FRENCH_NAMES = [
	"Marie-Christine",
	"Jean-Sébastien",
	"Élisabeth",
	"Émile",
	"Chloé",
	"Anne-Sophie",
	"Théophile",
	"Geneviève",
	"Rémi",
	"Zoé",
	"Léa",
	"Côme",
];

const seats = (count: number) =>
	Array.from({ length: count }, (_, index) => ({
		id: `p${index}`,
		name: FRENCH_NAMES[index] ?? `Joueur ${index + 1}`,
		colorIndex: index + 1,
		sortOrder: index,
	}));

const session = (overrides: Partial<Session> = {}): Session => ({
	id: "s1",
	name: "Chez Marie",
	templateId: "7-wonders",
	mode: "sheet",
	categories: template("7-wonders").categories,
	win: "highest",
	players: seats(7),
	rounds: [{}],
	status: "active",
	createdAt: "2026-04-12T19:00:00.000Z",
	updatedAt: "2026-04-12T19:00:00.000Z",
	...overrides,
});

const mount = async (node: React.ReactNode, path = "/session/s1") => {
	const root = createRootRoute();
	const here = createRoute({
		getParentRoute: () => root,
		path,
		component: () => <AppProvider>{node}</AppProvider>,
	});
	const others = ["/", "/new", "/new/players", "/session/$id/results"]
		.filter((each) => each !== path)
		.map((each) =>
			createRoute({
				getParentRoute: () => root,
				path: each,
				component: () => <p>ailleurs</p>,
			}),
		);
	const session2 = createRoute({
		getParentRoute: () => root,
		path: "/session/$id",
		component: () => <p>ailleurs</p>,
	});

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren(
					path === "/session/$id"
						? [here, ...others]
						: [here, session2, ...others],
				),
				history: createMemoryHistory({ initialEntries: [path] }),
			})}
		/>,
	);

	// The router resolves its first match asynchronously; without this every
	// assertion below runs against an empty document.
	await waitFor(() => expect(document.body.textContent).not.toBe(""));
};

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	await loadSessions();
	overwriteGetLocale(() => "fr");
	overwriteSetLocale(() => undefined);
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
	}));
});

afterEach(() => vi.unstubAllGlobals());

describe("the game shelf, eleven tiles", () => {
	it("counts its own games in French", async () => {
		await mount(<GameShelf />, "/new");
		expect(
			screen.getByPlaceholderText(`Filtrer les ${templates.length} jeux`),
		).toBeDefined();
	});

	it("says so in French when nothing matches", async () => {
		await mount(<GameShelf />, "/new");
		fireEvent.change(screen.getByRole("textbox"), {
			target: { value: "krib" },
		});
		expect(screen.getByText(/Aucun jeu ne correspond/)).toBeDefined();
		// Two ways out, both named the same because they do the same thing: the
		// × inside the field, and the no-match state's own button.
		expect(
			screen.getAllByRole("button", { name: "Effacer le filtre" }),
		).toHaveLength(2);
	});
});

describe("player setup, twelve counter players", () => {
	it("labels the screen and its blocking reason in French", async () => {
		await mount(<PlayerSetup template={template("counter")} />, "/new/players");

		expect(screen.getByRole("heading", { name: "Joueurs" })).toBeDefined();
		// Two blank rows: the count is legal, so the reason is the empty name.
		expect(screen.getByText("Chaque joueur doit avoir un nom.")).toBeDefined();
	});

	it("calls a team a team, and keeps the banner auto-height", async () => {
		await mount(<PlayerSetup template={template("belote")} />, "/new/players");

		expect(screen.getByRole("heading", { name: "Équipes" })).toBeDefined();
		const banner = screen.getByText("Chaque équipe doit avoir un nom.");
		// French is the longest string this container ever holds; a fixed height
		// is what would clip it.
		expect(banner.className).not.toMatch(/\bh-\[/);
		expect(banner.className).not.toMatch(/\bh-\d/);
	});
});

describe("the sheet, seven players and seven categories", () => {
	const sevenWonders = session();

	it("names the table and the category in French", async () => {
		await mount(<SheetScreen session={sevenWonders} />);
		expect(screen.getByText("7 Wonders · 7 joueurs")).toBeDefined();
		expect(screen.getByText(/Catégorie 1 sur 7/)).toBeDefined();
	});

	it("names the next player on the keypad primary", async () => {
		await mount(<SheetScreen session={sevenWonders} />);
		fireEvent.click(
			screen.getByRole("button", { name: "Marie-Christine : rien de saisi" }),
		);
		expect(
			screen.getByRole("button", { name: /Suivant — Jean-Sébastien/ }),
		).toBeDefined();
	});
});

describe("the tally standings, twelve players", () => {
	const uno = session({
		templateId: "uno",
		mode: "tally",
		categories: template("uno").categories,
		targetScore: 500,
		players: seats(12),
		rounds: [
			Object.fromEntries(seats(12).map((p, i) => [p.id, { points: i * 5 }])),
		],
	});

	it("names the game, the table and the target in French", async () => {
		await mount(<TallyScreen session={uno} />);
		expect(screen.getByText("Uno · 12 joueurs · à 500")).toBeDefined();
	});

	it("recaps the hand and names the next one in French", async () => {
		await mount(<TallyScreen session={uno} />);
		expect(screen.getByText(/Manche 1 · Côme prend 55/)).toBeDefined();
		expect(
			screen.getByRole("button", { name: /Saisir la manche 2/ }),
		).toBeDefined();
	});

	it("states a passed target in French, above the entry button", async () => {
		const passed = session({
			...uno,
			rounds: [{ p0: { points: 520 } }],
		});
		await mount(<TallyScreen session={passed} />);
		expect(
			screen.getByText(
				/Marie-Christine a dépassé 500 · terminez depuis ⋯ quand la table a fini/,
			),
		).toBeDefined();
	});
});

describe("the entry sheet, twelve players", () => {
	it("names whose number it is and who is next, in French", async () => {
		const uno = session({
			templateId: "uno",
			mode: "tally",
			categories: template("uno").categories,
			players: seats(12),
			rounds: [],
		});
		await mount(
			<EntrySheet session={uno} roundIndex={0} onClose={() => undefined} />,
		);

		expect(
			screen.getByRole("heading", { name: "Marie-Christine" }),
		).toBeDefined();
		expect(screen.getByText("Manche 1")).toBeDefined();
		expect(
			screen.getByRole("button", { name: /Suivant — Jean-Sébastien/ }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Effacer" })).toBeDefined();
	});

	it("counts a fixed-total hand in French", async () => {
		const blackLady = session({
			templateId: "black-lady",
			mode: "tally",
			categories: template("black-lady").categories,
			handTotal: 26,
			win: "lowest",
			players: seats(6),
			rounds: [],
		});
		await mount(
			<EntrySheet
				session={blackLady}
				roundIndex={8}
				onClose={() => undefined}
			/>,
		);
		expect(
			screen.getByText("Manche 9 · 26 à répartir · 0 placés"),
		).toBeDefined();
	});
});

describe("hand history, twelve players", () => {
	it("titles and labels the ledger in French", async () => {
		const uno = session({
			templateId: "uno",
			mode: "tally",
			categories: template("uno").categories,
			players: seats(12),
			rounds: [Object.fromEntries(seats(12).map((p) => [p.id, { points: 7 }]))],
		});
		await mount(<HandHistory session={uno} />, "/session/$id/history");

		expect(
			screen.getByRole("heading", { name: "Historique des manches" }),
		).toBeDefined();
		expect(
			screen.getByText("Chez Marie · 1 manche · 12 joueurs"),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Par manche" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Cumul" })).toBeDefined();
		expect(screen.getByText("Touchez une case pour corriger")).toBeDefined();
	});
});

describe("results, twelve players and a tie", () => {
	it("carries the whole footer in French at 390px", async () => {
		const tied = session({
			status: "finished",
			finishedAt: "2026-04-12T21:24:00.000Z",
			tiebreakNote: "Le plus de pièces l'emporte.",
			players: seats(12),
			rounds: [{ p0: { military: 5 }, p1: { military: 5 } }],
		});
		await mount(<ResultsScreen session={tied} />, "/session/$id/results");

		expect(screen.getByText("Ex æquo")).toBeDefined();
		expect(screen.getByText("Départage · 7 Wonders")).toBeDefined();
		expect(screen.getByText("Final · 12 joueurs")).toBeDefined();

		// The three-up row is the tightest slot on the screen: ~111px each.
		for (const label of ["Rejouer", "Rouvrir", "Exporter"]) {
			const button = screen.getByRole("button", { name: label });
			// Auto-height and no fixed width — the button is what survives if
			// French does not fit, per SPEC.md §7. `min-w-0` is allowed and is
			// what lets a long label shrink rather than push the row wider.
			expect(button.className).not.toMatch(/(?<!-)\bw-\d/);
			expect(button.className).not.toMatch(/\bh-\d/);
			expect(button.className).toMatch(/flex-1/);
		}
		expect(
			screen.getByRole("button", { name: "Retour aux jeux" }),
		).toBeDefined();
	});
});

describe("plurals", () => {
	/**
	 * French agrees the noun with the number, and so does English — a count of
	 * one used to read `1 manches` / `1 hands` everywhere a figure met a noun.
	 * `Intl.PluralRules` decides, per locale, through paraglide's variants, so
	 * neither language carries a hand-written rule.
	 */
	const uno = (hands: number, players: number) =>
		session({
			templateId: "uno",
			mode: "tally",
			categories: template("uno").categories,
			players: seats(players),
			rounds: Array.from({ length: hands }, () => ({
				p0: { points: 7 },
			})),
		});

	it("agrees the noun with the number in French", async () => {
		await mount(<HandHistory session={uno(1, 1)} />, "/session/$id/history");
		expect(screen.getByText("Chez Marie · 1 manche · 1 joueur")).toBeDefined();
		expect(screen.getByText("1 manche")).toBeDefined();
	});

	it("agrees it in English too", async () => {
		overwriteGetLocale(() => "en");
		await mount(<HandHistory session={uno(1, 1)} />, "/session/$id/history");
		expect(screen.getByText("Chez Marie · 1 hand · 1 player")).toBeDefined();
	});

	it("still says manches past one", async () => {
		await mount(<HandHistory session={uno(3, 2)} />, "/session/$id/history");
		expect(
			screen.getByText("Chez Marie · 3 manches · 2 joueurs"),
		).toBeDefined();
	});

	/** French counts zero as singular; English does not. Intl knows, we do not. */
	it("follows each locale's own rule at zero", async () => {
		await mount(<HandHistory session={uno(0, 2)} />, "/session/$id/history");
		expect(screen.getByText("Chez Marie · 0 manche · 2 joueurs")).toBeDefined();

		cleanup();
		overwriteGetLocale(() => "en");
		await mount(<HandHistory session={uno(0, 2)} />, "/session/$id/history");
		expect(screen.getByText("Chez Marie · 0 hands · 2 players")).toBeDefined();
	});
});
