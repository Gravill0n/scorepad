import { act, render, screen, waitFor } from "@testing-library/react";
import { type Locale, useSettings } from "@/hooks/useSettings";
import { closeDatabase, getMeta, putMeta } from "@/lib/db";
import { m } from "@/paraglide/messages";
import { overwriteGetLocale, overwriteSetLocale } from "@/paraglide/runtime";
import { AppProvider } from "./provider";

const wipeDatabase = () =>
	new Promise<void>((resolve) => {
		const request = indexedDB.deleteDatabase("bgc");
		request.onsuccess = () => resolve();
		request.onblocked = () => resolve();
	});

/** jsdom implements no matchMedia at all, so the OS preference is stubbed. */
let listeners: ((event: MediaQueryListEvent) => void)[] = [];

const stubOperatingSystem = (prefersDark: boolean) => {
	listeners = [];
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: prefersDark && query.includes("dark"),
		media: query,
		addEventListener: (_: string, listener: (e: MediaQueryListEvent) => void) =>
			listeners.push(listener),
		removeEventListener: () => undefined,
	}));
};

const changeOperatingSystemTo = (prefersDark: boolean) =>
	act(() => {
		for (const listener of listeners) {
			listener({ matches: prefersDark } as MediaQueryListEvent);
		}
	});

const Probe = () => {
	const { theme, locale, setTheme, setLocale } = useSettings();
	return (
		<>
			<span data-testid="theme">{theme}</span>
			<span data-testid="locale">{locale}</span>
			<button type="button" onClick={() => setTheme("dark")}>
				dark
			</button>
			<button type="button" onClick={() => setLocale("fr")}>
				fr
			</button>
		</>
	);
};

/** Renders through paraglide, so a stale locale shows up as stale copy. */
const MessageProbe = () => {
	const { setLocale } = useSettings();
	return (
		<>
			<span data-testid="copy">{m.home_new_game()}</span>
			<button type="button" onClick={() => setLocale("fr")}>
				fr
			</button>
		</>
	);
};

const renderApp = () =>
	render(
		<AppProvider>
			<Probe />
		</AppProvider>,
	);

const documentTheme = () => document.documentElement.dataset.theme;

beforeEach(async () => {
	closeDatabase();
	await wipeDatabase();
	stubOperatingSystem(false);
	overwriteGetLocale(() => "en");
	overwriteSetLocale(() => undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("an untouched install", () => {
	it("follows a dark OS preference", async () => {
		stubOperatingSystem(true);
		renderApp();
		await waitFor(() =>
			expect(screen.getByTestId("theme").textContent).toBe("dark"),
		);
		expect(documentTheme()).toBe("dark");
	});

	it("follows a light OS preference", async () => {
		renderApp();
		await waitFor(() => expect(documentTheme()).toBe("light"));
	});

	it("follows navigator's language", async () => {
		overwriteGetLocale(() => "fr");
		renderApp();
		await waitFor(() =>
			expect(screen.getByTestId("locale").textContent).toBe("fr"),
		);
	});

	it("writes nothing to meta, so absence stays meaningful", async () => {
		renderApp();

		// Waiting on the rendered theme is not enough: light is already correct
		// on the first paint, so the assertion would run before the load effect
		// has even issued its read. Two database round trips instead — the first
		// lets the provider's own read resolve and any write it makes be issued,
		// the second is ordered after that write by IndexedDB itself.
		await act(async () => {
			await getMeta("schemaVersion");
		});
		await act(async () => {
			await getMeta("schemaVersion");
		});

		expect(await getMeta("theme")).toBeUndefined();
		expect(await getMeta("locale")).toBeUndefined();
	});

	it("keeps following the OS while the app is open", async () => {
		renderApp();
		await waitFor(() => expect(documentTheme()).toBe("light"));

		changeOperatingSystemTo(true);
		expect(documentTheme()).toBe("dark");
	});
});

describe("a touched setting", () => {
	it("beats the OS preference", async () => {
		await putMeta("theme", "light");
		stubOperatingSystem(true);

		renderApp();
		await waitFor(() =>
			expect(screen.getByTestId("theme").textContent).toBe("light"),
		);
		expect(documentTheme()).toBe("light");
	});

	it("stops the OS from changing it underneath", async () => {
		// The OS and the stored value must disagree, or waiting for "light"
		// proves nothing: it is also what an unloaded provider shows on a light
		// OS, and the assertion below would then race the database read.
		stubOperatingSystem(true);
		await putMeta("theme", "light");
		renderApp();

		await waitFor(() =>
			expect(screen.getByTestId("theme").textContent).toBe("light"),
		);

		changeOperatingSystemTo(false);
		changeOperatingSystemTo(true);
		expect(documentTheme()).toBe("light");
	});

	it("survives a reload — success criterion 14", async () => {
		const first = renderApp();
		await waitFor(() => expect(documentTheme()).toBe("light"));

		await act(async () => {
			screen.getByRole("button", { name: "dark" }).click();
		});
		await waitFor(() => expect(documentTheme()).toBe("dark"));

		// Reload: tear the tree down and reopen the database from scratch.
		first.unmount();
		closeDatabase();

		renderApp();
		await waitFor(() =>
			expect(screen.getByTestId("theme").textContent).toBe("dark"),
		);
	});

	it("persists a chosen locale and tells paraglide about it", async () => {
		const applied: string[] = [];
		overwriteSetLocale((next: string) => {
			applied.push(next);
		});

		renderApp();
		await waitFor(() =>
			expect(screen.getByTestId("locale").textContent).toBe("en"),
		);

		await act(async () => {
			screen.getByRole("button", { name: "fr" }).click();
		});

		await waitFor(() =>
			expect(screen.getByTestId("locale").textContent).toBe("fr"),
		);
		expect(await getMeta("locale")).toBe("fr");
		expect(applied).toContain("fr");
		expect(document.documentElement.lang).toBe("fr");
	});

	it("renders the new language on the tap, not on the next re-render", async () => {
		// Paraglide reads its locale when a message is called. Setting it in an
		// effect is a render too late: the tap re-renders the tree in the old
		// language, and nothing schedules a second render to correct it, so the
		// screen stays English until something unrelated changes.
		let current: Locale = "en";
		overwriteGetLocale(() => current);
		overwriteSetLocale((next: string) => {
			current = next === "fr" ? "fr" : "en";
		});

		render(
			<AppProvider>
				<MessageProbe />
			</AppProvider>,
		);
		const english = screen.getByTestId("copy").textContent;

		await act(async () => {
			screen.getByRole("button", { name: "fr" }).click();
		});

		expect(screen.getByTestId("copy").textContent).not.toBe(english);
	});

	it("keeps a choice made before the stored settings have arrived", async () => {
		// The load effect resolves after the tap. If it replaces the settings
		// object wholesale it reverts the choice that was just made, and the
		// only symptom is a toggle that sometimes does nothing.
		await putMeta("theme", "light");

		renderApp();
		await act(async () => {
			screen.getByRole("button", { name: "dark" }).click();
		});

		// Let the pending read land on top.
		await act(async () => {
			await getMeta("schemaVersion");
		});
		await act(async () => {
			await getMeta("schemaVersion");
		});

		expect(documentTheme()).toBe("dark");
		expect(await getMeta("theme")).toBe("dark");
	});

	it("goes back to the OS once meta is cleared", async () => {
		await putMeta("theme", "dark");
		const first = renderApp();
		await waitFor(() => expect(documentTheme()).toBe("dark"));

		first.unmount();
		closeDatabase();
		await wipeDatabase();

		renderApp();
		await waitFor(() => expect(documentTheme()).toBe("light"));
	});
});

describe("useSettings", () => {
	it("refuses to run without a provider above it", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		expect(() => render(<Probe />)).toThrow(/AppProvider/);
		vi.restoreAllMocks();
	});
});
