import { Fragment, type ReactNode, useEffect, useState } from "react";
import { type Locale, SettingsContext, type Theme } from "@/hooks/useSettings";
import { getMeta, putMeta } from "@/lib/db";
import { registerServiceWorker } from "@/lib/installPrompt";
import { loadSessions } from "@/lib/sessions";
import {
	getLocale,
	setLocale as setParaglideLocale,
} from "@/paraglide/runtime";
import { THEME_COLOR } from "@/utils/themeColor";

/** Absent means untouched, which is not the same as a stored default. */
type Stored = { theme?: Theme; locale?: Locale };

const systemTheme = (): Theme =>
	globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches
		? "dark"
		: "light";

/** Paraglide's own resolution: globalVariable, then navigator, then "en". */
const systemLocale = (): Locale => (getLocale() === "fr" ? "fr" : "en");

/**
 * Paraglide reads its locale when a message is called, not when React state
 * lands, so it is set at the moment the choice is made rather than in an
 * effect. An effect runs after the render it should have changed: the tap would
 * re-render the whole tree in the old language and nothing would schedule the
 * second render that corrects it.
 */
const applyToParaglide = (next: Locale | undefined) => {
	if (next && getLocale() !== next) setParaglideLocale(next, { reload: false });
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
	const [stored, setStored] = useState<Stored>({});
	const [system, setSystem] = useState<Theme>(systemTheme);

	const theme = stored.theme ?? system;
	const locale = stored.locale ?? systemLocale();

	// Load what the user has actually chosen. Until this resolves the OS wins,
	// which is also the answer when nothing was ever chosen.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const [savedTheme, savedLocale] = await Promise.all([
				getMeta("theme"),
				getMeta("locale"),
			]);
			// Merged, not replaced. This read finishes after the first paint, so
			// a setting tapped in the meantime is already in `current` — writing
			// the stored object wholesale would revert it, and the only symptom
			// would be a toggle that sometimes does nothing.
			if (!cancelled) {
				setStored((current) => {
					const next = {
						theme: current.theme ?? savedTheme,
						locale: current.locale ?? savedLocale,
					};
					applyToParaglide(next.locale);
					return next;
				});
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// One read at boot; every screen reads the store from then on.
	useEffect(() => {
		void loadSessions();
	}, []);

	// Installability and the offline cold start. It resolves false on a
	// non-secure origin rather than throwing — nothing in the app needs it to
	// have worked, and `bun dev` over a LAN address is exactly that origin.
	useEffect(() => {
		void registerServiceWorker();
	}, []);

	// An untouched install keeps following the OS, including while it is open.
	useEffect(() => {
		const query = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
		if (!query) return;
		const onChange = (event: MediaQueryListEvent) =>
			setSystem(event.matches ? "dark" : "light");
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	// tokens.css keys dark off [data-theme="dark"] and has no
	// prefers-color-scheme block, so the OS preference only reaches the palette
	// through this attribute.
	useEffect(() => {
		document.documentElement.dataset.theme = theme;

		// The status bar takes its colour from this, and in a standalone install
		// the status bar is the app's own top edge — a light bar over the dark
		// theme is a seam you can see. The <meta> pair in the document head
		// follows the OS; a chosen theme has to move it here.
		const meta = document.querySelector(
			'meta[name="theme-color"]:not([media])',
		);
		meta?.setAttribute("content", THEME_COLOR[theme]);
	}, [theme]);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const setTheme = (next: Theme) => {
		setStored((current) => ({ ...current, theme: next }));
		void putMeta("theme", next);
	};

	const setLocale = (next: Locale) => {
		applyToParaglide(next);
		setStored((current) => ({ ...current, locale: next }));
		void putMeta("locale", next);
	};

	return (
		<SettingsContext.Provider value={{ theme, locale, setTheme, setLocale }}>
			{/* Keyed on the locale, so a language switch remounts the tree.
			    babel-plugin-react-compiler caches every `m.*()` call for the life
			    of a component instance — the call takes no reactive input, so a
			    re-render reuses the string it computed the first time and the
			    screen stays in the old language forever. The alternative is
			    hand-passing `locale` into every message call in the app; this is
			    one line, and it costs a remount on a tap somebody makes once. */}
			<Fragment key={locale}>{children}</Fragment>
		</SettingsContext.Provider>
	);
};
