/**
 * The status bar's colour, in the two themes.
 *
 * **The only literal colours in the app**, and they have to be literals: a
 * `<meta name="theme-color">` carries a string the browser reads before any
 * stylesheet exists, so `var(--color-paper)` would mean nothing there. They are
 * `--color-paper` from each theme in `tokens.css`, and a test asserts they
 * still are — this file is the one place they can drift from, so it is the one
 * place to guard.
 */
export const THEME_COLOR = {
	light: "#f6f1e7",
	dark: "#201c16",
} as const;
