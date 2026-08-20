import type { ReactNode } from "react";

/**
 * The mono 11 uppercase label that heads every section: `IN PROGRESS`,
 * `FINISHED · 4`, `BACKUP`, `PLAYED RECENTLY`, `TIEBREAK · Splendor`.
 *
 * Uppercasing is a CSS transform rather than shouted copy, so the message
 * files hold sentence case and French accents survive.
 */
export const Eyebrow = ({ children }: { children: ReactNode }) => (
	<p className="font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
		{children}
	</p>
);
