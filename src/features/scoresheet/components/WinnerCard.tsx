import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import type { Player } from "@/types/session";

/** Intl writes "Chloé and Émile" / "Chloé et Émile" so we don't keep a table. */
const joinNames = (names: string[], locale: "en" | "fr") =>
	new Intl.ListFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		type: "conjunction",
	}).format(names);

/**
 * **One winner block however many winners there are** (`1n`).
 *
 * Tied players share the block, share the rank number, and carry `=` down the
 * list. Nothing here picks between them: the deciding data was never entered,
 * and inventing a result is worse than saying the tie out loud.
 */
export const WinnerCard = ({
	winners,
	total,
	locale,
}: {
	winners: Player[];
	total: number;
	locale: "en" | "fr";
}) => {
	const joint = winners.length > 1;

	return (
		<div className="rounded-card border border-accent bg-card p-3.5">
			<p className="font-mono text-eyebrow tracking-eyebrow text-accent uppercase">
				{joint ? m.results_joint_winners() : m.results_winner()}
			</p>

			<div className="mt-2.5 flex items-center gap-3">
				{/* Overlapping tokens: one block, not one row per winner. */}
				<span className="flex shrink-0">
					{winners.map((winner, index) => (
						<span
							key={winner.id}
							className="rounded-token ring-2 ring-card"
							style={{ marginLeft: index === 0 ? 0 : -10 }}
						>
							<PlayerToken
								name={winner.name}
								colorIndex={winner.colorIndex}
								size={40}
							/>
						</span>
					))}
				</span>

				<p className="min-w-0 flex-1 text-strong font-[var(--weight-semi)] leading-snug text-ink text-pretty">
					{joinNames(
						winners.map((winner) => winner.name),
						locale,
					)}
				</p>

				<p className="num shrink-0 text-total font-[var(--weight-bold)] leading-none text-accent">
					{total}
				</p>
			</div>
		</div>
	);
};
