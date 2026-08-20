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
 */
export const Eyebrow = ({ children, tone = "soft" }: EyebrowProps) => (
	<p
		className={`font-mono text-eyebrow tracking-eyebrow uppercase ${
			tone === "faint" ? "text-ink-faint" : "text-ink-soft"
		}`}
	>
		{children}
	</p>
);
