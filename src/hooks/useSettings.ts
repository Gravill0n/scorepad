import { createContext, useContext } from "react";

export type Theme = "light" | "dark";
export type Locale = "en" | "fr";

export type Settings = {
	theme: Theme;
	locale: Locale;
	setTheme: (theme: Theme) => void;
	setLocale: (locale: Locale) => void;
};

/**
 * The app's only two settings, readable from any screen.
 *
 * The context lives in shared rather than beside the provider that owns it:
 * features may import shared and never the app layer, and the theme toggle and
 * the backup card's date format both sit inside a feature.
 */
export const SettingsContext = createContext<Settings | null>(null);

export const useSettings = (): Settings => {
	const settings = useContext(SettingsContext);
	if (!settings) throw new Error("useSettings needs an AppProvider above it");
	return settings;
};
