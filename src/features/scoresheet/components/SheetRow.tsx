import { useEffect, useRef } from "react";
import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import type { Player } from "@/types/session";
import { ordinal } from "../utils/ordinal";

type SheetRowProps = {
	player: Player;
	/** The player's total across every category, recomputed on each keystroke. */
	total: number;
	rank: number;
	tied: boolean;
	/** Undefined is an empty cell, which is not the same as a zero. */
	value: number | undefined;
	focused: boolean;
	locale: "en" | "fr";
	onFocus: () => void;
};

/**
 * One player's row for the current category (`1c`).
 *
 * The row never moves. Totals and the rank *label* recompute on every
 * keystroke, but position is seat order for the whole game: the distraction
 * problem is solved by freezing position, not by hiding values, and nothing
 * slides under a thumb mid-entry.
 */
export const SheetRow = ({
	player,
	total,
	rank,
	tied,
	value,
	focused,
	locale,
	onFocus,
}: SheetRowProps) => {
	const row = useRef<HTMLLIElement>(null);

	// The keypad takes the bottom half of the screen, so the row being typed
	// into can end up behind it — at seven players it usually does. Bring it
	// back: typing into a cell you cannot see is how the wrong row gets scored.
	useEffect(() => {
		if (focused) row.current?.scrollIntoView?.({ block: "nearest" });
	}, [focused]);

	return (
		<li
			ref={row}
			className="flex h-[var(--h-sheet-row)] items-center gap-3 border-line border-b px-4"
		>
			<PlayerToken
				name={player.name}
				colorIndex={player.colorIndex}
				size={28}
			/>

			<span className="min-w-0 flex-1">
				<span className="block truncate text-row font-[var(--weight-medium)] text-ink">
					{player.name}
				</span>
				<span className="num block font-mono text-eyebrow text-ink-soft uppercase">
					{m.sheet_so_far({ total })} · {ordinal(rank, locale)}
					{tied ? "=" : ""}
				</span>
			</span>

			<button
				type="button"
				onClick={onFocus}
				aria-label={
					value === undefined
						? m.sheet_cell_empty({ player: player.name })
						: m.sheet_cell({ player: player.name, value })
				}
				className={`num flex h-[var(--h-cell)] w-16 shrink-0 items-center justify-center rounded-ctrl text-cell font-[var(--weight-semi)] ${
					focused
						? "border border-accent bg-card text-ink shadow-[var(--focus-ring)]"
						: value === undefined
							? "border border-line-dashed border-dashed bg-paper text-ink-faint"
							: "border border-line bg-card text-ink"
				}`}
			>
				{value === undefined ? "—" : value}
			</button>
		</li>
	);
};
