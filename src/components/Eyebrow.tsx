import type { ReactNode } from "react";

type EyebrowProps = {
	children: ReactNode;
	/**
	 * `soft` is the section heading — IN PROGRESS, FINISHED · 4, BACKUP.
	 * `faint` is the quieter aside, like first run's offline promise.
	 */
	tone?: "soft" | "faint";
};

/**
 * The mono 11 uppercase label that heads every section.
 *
 * Uppercasing is a CSS transform rather than shouted copy, so the message
 * files hold sentence case and French accents survive.
 *
 * `text-balance` is for the one eyebrow that does not fit on a line in French:
 * first run's offline promise is 38 characters in English and 50 in French, and
 * 50 at mono 11 with `--tracking-eyebrow` lands within a few pixels of 390's
 * usable width. A balanced wrap is right whichever side of that it falls on; it
 * is a no-op for every single-line eyebrow.
 */
export const Eyebrow = ({ children, tone = "soft" }: EyebrowProps) => (
	<p
		className={`font-mono text-eyebrow tracking-eyebrow text-balance uppercase ${
			tone === "faint" ? "text-ink-faint" : "text-ink-soft"
		}`}
	>
		{children}
	</p>
);
