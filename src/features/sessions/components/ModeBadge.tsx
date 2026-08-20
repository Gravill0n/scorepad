import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";

/**
 * `SHEET` / `TALLY`. Load-bearing on the shelf (`1f`): it tells you the shape
 * of the screen you are about to get, before you have chosen anything.
 */
export const ModeBadge = ({ mode }: { mode: Session["mode"] }) => (
	<span className="rounded-token border border-line px-1.5 py-0.5 font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
		{mode === "sheet" ? m.badge_sheet() : m.badge_tally()}
	</span>
);
