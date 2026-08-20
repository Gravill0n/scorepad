import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { getMeta, putMeta } from "@/lib/db";
import { loadSessions } from "@/lib/sessions";
import {
	getLocale,
	setLocale as setParaglideLocale,
} from "@/paraglide/runtime";

export type Theme = "light" | "dark";
export type Locale = "en" | "fr";

/** Absent means untouched, which is not the same as a stored default. */
type Stored = { theme?: Theme; locale?: Locale };

const systemTheme = (): Theme =>
	globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.matches
		? "dark"
		: "light";

/** Paraglide's own resolution: globalVariable, then navigator, then "en". */
const systemLocale = (): Locale => (getLocale() === "fr" ? "fr" : "en");

type Settings = {
	theme: Theme;
	locale: Locale;
	setTheme: (theme: Theme) => void;
	setLocale: (locale: Locale) => void;
};

const SettingsContext = createContext<Settings | null>(null);

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
			if (!cancelled) setStored({ theme: savedTheme, locale: savedLocale });
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// One read at boot; every screen reads the store from then on.
	useEffect(() => {
		void loadSessions();
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
	}, [theme]);

	useEffect(() => {
		if (getLocale() !== locale) setParaglideLocale(locale, { reload: false });
		document.documentElement.lang = locale;
	}, [locale]);

	const setTheme = (next: Theme) => {
		setStored((current) => ({ ...current, theme: next }));
		void putMeta("theme", next);
	};

	const setLocale = (next: Locale) => {
		setStored((current) => ({ ...current, locale: next }));
		void putMeta("locale", next);
	};

	return (
		<SettingsContext.Provider value={{ theme, locale, setTheme, setLocale }}>
			{children}
		</SettingsContext.Provider>
	);
};

export const useSettings = (): Settings => {
	const settings = useContext(SettingsContext);
	if (!settings) throw new Error("useSettings needs an AppProvider above it");
	return settings;
};
