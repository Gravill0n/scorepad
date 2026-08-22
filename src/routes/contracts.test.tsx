import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { render, waitFor } from "@testing-library/react";
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
 * The design contracts, asserted where a refactor can silently break them.
 *
 * **jsdom has no layout engine**, so nothing here measures a rendered box.
 * What it can do is resolve the height *utility* every interactive element
 * carries back to the pixel value in `tokens.css` — which is the same contract
 * from the other end, and it fails the moment somebody writes `h-8` on a
 * button. The 390 × 844 frame check needs a real viewport and is not here; see
 * the note at the foot of this file.
 */
const tokens = readFileSync("src/tokens.css", "utf8");

/** `--h-tap: 2.75rem` → 44. The floor is a token, so read it from the token. */
const tokenPx = (name: string): number => {
	const rem = tokens.match(new RegExp(`--h-${name}:\\s*([\\d.]+)rem`))?.[1];
	if (!rem) throw new Error(`--h-${name} is not in tokens.css`);
	return Number(rem) * 16;
};

/** Tailwind's default scale is 4px per step. */
const TAP_FLOOR = tokenPx("tap");

const ownHeight = (element: Element): number | undefined => {
	for (const name of element.classList) {
		const token = name.match(/^h-\[var\(--h-([a-z-]+)\)\]$/)?.[1];
		if (token) return tokenPx(token);

		const steps = name.match(/^h-(\d+(?:\.\d+)?)$/)?.[1];
		if (steps) return Number(steps) * 4;
	}
	return undefined;
};

/**
 * The height a control actually ends up with. A filter field is `h-full`
 * inside a 48px row and a setup name field fills its row the same way — the
 * box is real, it is just declared one level up, so the walk goes up until it
 * finds the element that sets it.
 */
const heightOf = (element: Element): number | undefined => {
	let node: Element | null = element;
	while (node && node !== document.body) {
		const height = ownHeight(node);
		if (height !== undefined) return height;
		node = node.parentElement;
	}
	return undefined;
};

const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"]';

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

const template = (id: string) =>
	templates.find((each) => each.id === id) as Template;

const seats = (count: number) =>
	Array.from({ length: count }, (_, index) => ({
		id: `p${index}`,
		name: `Joueur ${index + 1}`,
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
	const elsewhere = [
		"/",
		"/new",
		"/new/players",
		"/session/$id",
		"/session/$id/results",
	]
		.filter((each) => each !== path)
		.map((each) =>
			createRoute({
				getParentRoute: () => root,
				path: each,
				component: () => <p>ailleurs</p>,
			}),
		);

	render(
		<RouterProvider
			router={createRouter({
				routeTree: root.addChildren([here, ...elsewhere]),
				history: createMemoryHistory({ initialEntries: [path] }),
			})}
		/>,
	);
	await waitFor(() => expect(document.body.textContent).not.toBe(""));
};

const uno = (players: number) =>
	session({
		templateId: "uno",
		mode: "tally",
		categories: template("uno").categories,
		targetScore: 500,
		players: seats(players),
		rounds: [
			Object.fromEntries(
				seats(players).map((p, i) => [p.id, { points: i * 5 }]),
			),
		],
	});

/** Every screen at the player count that squeezes it hardest, in French. */
const SCREENS: [string, () => React.ReactNode, string][] = [
	["the game shelf", () => <GameShelf />, "/new"],
	[
		"player setup at twelve",
		() => <PlayerSetup template={template("counter")} />,
		"/new/players",
	],
	[
		"the sheet at seven",
		() => <SheetScreen session={session()} />,
		"/session/s1",
	],
	[
		"the standings at twelve",
		() => <TallyScreen session={uno(12)} />,
		"/session/s1",
	],
	[
		"the entry sheet at twelve",
		() => (
			<EntrySheet session={uno(12)} roundIndex={1} onClose={() => undefined} />
		),
		"/session/s1",
	],
	[
		"hand history at twelve",
		() => <HandHistory session={uno(12)} />,
		"/session/s1",
	],
	[
		"results at twelve",
		() => (
			<ResultsScreen
				session={session({
					status: "finished",
					finishedAt: "2026-04-12T21:24:00.000Z",
					players: seats(12),
				})}
			/>
		),
		"/session/s1",
	],
];

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

describe.each(SCREENS)("%s", (_name, node, path) => {
	it("gives every interactive element at least the thumb floor", async () => {
		await mount(node(), path);

		const undersized = [...document.querySelectorAll(INTERACTIVE)]
			.map((element) => ({
				element,
				height: heightOf(element),
			}))
			.filter(({ height }) => height !== undefined && height < TAP_FLOOR)
			.map(
				({ element, height }) =>
					`${element.tagName.toLowerCase()} "${(element.getAttribute("aria-label") ?? element.textContent ?? "").slice(0, 30)}" is ${height}px`,
			);

		expect(undersized).toEqual([]);
	});

	/**
	 * A control whose height comes from its content cannot be checked here at
	 * all — jsdom will not lay it out. The list is allowed to hold exactly the
	 * kinds of box that are deliberately content-sized, so a *new* unsized
	 * control shows up as a failure and has to be justified rather than
	 * quietly joining them.
	 */
	it("sizes every interactive element from a token, or is a known tile", async () => {
		await mount(node(), path);

		const unsized = [...document.querySelectorAll(INTERACTIVE)]
			.filter((element) => heightOf(element) === undefined)
			.map((element) => element.tagName.toLowerCase());

		// Only the shelf's game tiles, which are two lines of text over an art
		// field and are far past 44 at any type size.
		expect(new Set(unsized)).toEqual(new Set(unsized.length ? ["a"] : []));
	});
});

/** Leaf elements whose whole text is a figure — the things that jitter. */
const numericLeaves = () =>
	[...document.querySelectorAll("*")].filter(
		(element) =>
			element.children.length === 0 &&
			/^-?\d+$/.test((element.textContent ?? "").trim()),
	);

const hasTabularNumerals = (element: Element): boolean => {
	let node: Element | null = element;
	while (node && node !== document.body) {
		if (node.classList.contains("num")) return true;
		node = node.parentElement;
	}
	return false;
};

describe.each(SCREENS)("%s", (_name, node, path) => {
	/**
	 * Every recomputing figure carries `.num`. Without tabular numerals a total
	 * changes width as it counts up, and a column of them dances — which is the
	 * one thing a scorepad read across a table must not do.
	 */
	it("gives every figure on screen tabular numerals", async () => {
		await mount(node(), path);

		const jittery = numericLeaves()
			.filter((element) => !hasTabularNumerals(element))
			.map(
				(element) =>
					`${element.tagName.toLowerCase()} "${element.textContent}"`,
			);

		expect(jittery).toEqual([]);
	});
});

/** Every component in the tree, tests excluded. Vitest runs under node. */
const componentFiles = (dir = "src"): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return entry.name === "paraglide" ? [] : componentFiles(path);
		}
		return entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
			? [path]
			: [];
	});

const sources = componentFiles();

describe("scrolling", () => {
	/**
	 * Horizontal scroll is acceptable on hand history and nowhere else: it is
	 * opened to settle an argument, not watched all evening. Every other screen
	 * scales by getting denser.
	 */
	it("is horizontal on hand history and nowhere else", () => {
		const offenders = sources.filter((file) => {
			const source = readFileSync(file, "utf8");
			return (
				/overflow-x-auto|overflow-x-scroll|\boverflow-auto\b/.test(source) &&
				// The ledger: the sixth column bleeds past the edge on purpose.
				!file.endsWith("HandHistory.tsx") &&
				// Not a scrolling *screen* — decision 4 builds swipe-to-reveal out
				// of scroll-snap, so the horizontal scroller is a gesture surface
				// one row tall, and it is what makes the action keyboard-reachable.
				!file.endsWith("SwipeRow.tsx")
			);
		});

		expect(offenders).toEqual([]);
	});
});

describe("the token rules", () => {
	const withoutComments = (source: string) =>
		source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

	/**
	 * CLAUDE.md: a literal hex in a component is a bug. The single exception is
	 * the `<meta name="theme-color">` value, which the browser reads before any
	 * stylesheet exists — it lives in `utils/themeColor.ts`, alone, and
	 * `pwa.test.ts` asserts it still matches `tokens.css`.
	 */
	it("puts no literal colour in a component", () => {
		const offenders = sources
			.map(
				(file) => [file, withoutComments(readFileSync(file, "utf8"))] as const,
			)
			.filter(([, source]) => /#[0-9a-fA-F]{3,8}\b/.test(source))
			.map(([file]) => file);

		expect(offenders).toEqual([]);
	});

	it("keeps that one exception honest", () => {
		const themeColor = readFileSync("src/utils/themeColor.ts", "utf8");
		const literals = themeColor.match(/#[0-9a-fA-F]{6}/g) ?? [];

		expect(literals).toHaveLength(2);
		for (const colour of literals) expect(tokens).toContain(colour);
	});

	/** And no literal font size — the type scale is nine steps and a token. */
	it("puts no literal font size in a component", () => {
		const offenders = sources
			.map(
				(file) => [file, withoutComments(readFileSync(file, "utf8"))] as const,
			)
			.filter(([, source]) => /\btext-\[\d/.test(source))
			.map(([file]) => file);

		expect(offenders).toEqual([]);
	});

	/**
	 * The type scale is closed: nine steps, and every size in the app is one of
	 * them. This is the automatable half of criterion 13 — *which* slot counts
	 * as "body" is a judgment (the scale sanctions 13px for notes and captions
	 * in `--text-meta`'s own comment), but a size from outside the scale is
	 * unambiguously a bug, and 16 is the floor for everything above a label.
	 */
	it("takes every font size from the nine-step scale", () => {
		const scale = new Set(
			[...tokens.matchAll(/--text-([a-z]+):/g)].map(
				([, step]) => `text-${step}`,
			),
		);
		expect(scale.size).toBe(9);

		const offenders = sources.flatMap((file) => {
			const source = withoutComments(readFileSync(file, "utf8"));
			return [
				...source.matchAll(
					/\btext-(?!ink|paper|card|accent|alarm|advisory|balance|pretty|center|right|left)([a-z][a-z0-9]*)\b/g,
				),
			]
				.map(([match]) => match)
				.filter((used) => !scale.has(used))
				.map((used) => `${file}: ${used}`);
		});

		expect(offenders).toEqual([]);
	});

	/** Nor a literal duration: --dur-value and --dur-sheet are the only two. */
	it("puts no literal duration in a component", () => {
		const offenders = sources
			.map(
				(file) => [file, withoutComments(readFileSync(file, "utf8"))] as const,
			)
			.filter(([, source]) => /duration-\[\d|\b\d+ms\b/.test(source))
			.map(([file]) => file);

		expect(offenders).toEqual([]);
	});
});
