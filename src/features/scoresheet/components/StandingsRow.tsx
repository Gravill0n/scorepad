import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import { ordinal } from "../utils/ordinal";
import type { Density, StandingsRow as Row } from "../utils/tally";

/**
 * The drawn dimensions of each density tier (`2e`, `2a`, `2b`).
 *
 * `tokens.css` ships no density tokens — the design bundle has none — so this
 * is the one place they live rather than three literals per component. The
 * type sizes snap to the token scale: name 19 → `--text-strong` and total
 * 52 / 38 / 26 → `--text-total` / `--text-category` / `--text-cell`, which
 * keeps three distinct steps and holds the spec's floor that **the total never
 * drops below 26**. Owed to the designer along with the sizes themselves.
 */
const TIER = {
	roomy: { row: 132, token: 40, bar: 4, rank: 18, total: "text-total" },
	comfortable: {
		row: 102,
		token: 36,
		bar: 3,
		rank: 18,
		total: "text-category",
	},
	compact: { row: 62, token: 26, bar: 2, rank: 20, total: "text-cell" },
} as const satisfies Record<Density, unknown>;

type StandingsRowProps = {
	row: Row;
	tier: Density;
	win: "highest" | "lowest";
	locale: "en" | "fr";
};

/** `+60 last`, `-26 last`. The sign is the point, so a bare number won't do. */
const signed = (delta: number) => (delta > 0 ? `+${delta}` : String(delta));

/**
 * One player's standing (`2a`, `2b`, `2e`).
 *
 * The row **never re-sorts**: rank is a mono number in the margin and position
 * is seat order all evening, so the person you are looking for is where they
 * were last hand. Sorting happens exactly once, on Results.
 *
 * It scales 2 → 12 by shedding, never shrinking — the hands-won clause first,
 * then (in the screen above) the inline ledger, then the row's second line.
 */
export const StandingsRow = ({ row, tier, win, locale }: StandingsRowProps) => {
	const { player, total, rank, tied, toGo, racebar, handsWon, lastHand } = row;
	const size = TIER[tier];
	const leader = rank === 1;
	const isCompact = tier === "compact";

	const distance = toGo === undefined ? null : m.tally_to_go({ n: toGo });

	// Roomy has the room for the distance beside the hands won; comfortable
	// hangs it under the total instead, which is where `2a` draws it.
	const subline =
		tier === "roomy"
			? [m.tally_won({ n: handsWon }), distance].filter(Boolean).join(" · ")
			: [
					m.tally_won({ n: handsWon }),
					lastHand === undefined || lastHand === 0
						? m.tally_no_score()
						: m.tally_last({ delta: signed(lastHand) }),
				].join(" · ");

	return (
		<li
			className="flex flex-col justify-center border-line border-b px-4"
			style={{ height: size.row, gap: isCompact ? 7 : 12 }}
		>
			<div
				className="grid items-center"
				style={{
					gridTemplateColumns: `${size.rank}px ${size.token}px 1fr auto`,
					gap: isCompact ? 10 : 12,
				}}
			>
				<span className="num font-mono text-meta text-ink-faint">
					<span aria-hidden="true">
						{rank}
						{tied ? "=" : ""}
					</span>
					{/* The margin draws a bare number; a reader gets the ordinal. */}
					<span className="sr-only">
						{m.tally_rank({ rank: ordinal(rank, locale) })}
					</span>
				</span>

				<PlayerToken
					name={player.name}
					colorIndex={player.colorIndex}
					size={size.token}
				/>

				{isCompact ? (
					// Compact has shed its second line, so the distance rides inline
					// beside the name — the one thing a player looks for after the total.
					<span className="flex min-w-0 items-baseline gap-1.5">
						<span className="truncate text-body font-[var(--weight-semi)] text-ink">
							{player.name}
						</span>
						{distance ? (
							<span className="num shrink-0 font-mono text-eyebrow text-ink-soft">
								{distance}
							</span>
						) : null}
					</span>
				) : (
					<span className="min-w-0">
						<span className="flex items-center gap-1.5">
							<span className="truncate text-strong font-[var(--weight-semi)] text-ink">
								{player.name}
							</span>
							{/* Always in the layout, invisible for everyone but rank 1, so
							    the name baseline never shifts as the lead changes hands. */}
							<span
								aria-hidden={!leader}
								className={`shrink-0 rounded-chip border border-accent px-1 py-px font-mono text-eyebrow tracking-eyebrow text-accent uppercase ${
									leader ? "" : "opacity-0"
								}`}
							>
								{win === "lowest" ? m.tally_safest() : m.tally_leads()}
							</span>
						</span>
						<span className="num mt-0.5 block truncate font-mono text-eyebrow text-ink-soft uppercase">
							{subline}
						</span>
					</span>
				)}

				<span className="text-right">
					<span
						className={`num block ${size.total} font-[var(--weight-bold)] leading-none ${
							leader ? "text-accent" : "text-ink"
						}`}
					>
						{total}
					</span>
					{tier === "comfortable" && distance ? (
						<span className="num mt-1 block font-mono text-eyebrow text-ink-soft">
							{distance}
						</span>
					) : null}
				</span>
			</div>

			{racebar === undefined ? null : (
				<span
					className="block w-full bg-paper-dim"
					style={{ height: size.bar }}
					aria-hidden="true"
				>
					<span
						className={`block h-full ${leader ? "bg-accent" : "bg-ink-faint"}`}
						style={{ width: `${racebar * 100}%` }}
					/>
				</span>
			)}
		</li>
	);
};
