import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { PlayerToken } from "@/components/PlayerToken";
import { ScreenHeader } from "@/components/ScreenHeader";
import { playerTotal, roundScore } from "@/lib/scoring";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { EntrySheet } from "./EntrySheet";

type Mode = "hand" | "running";

/**
 * The ledger, on its own screen (`2d`). Reached from ⋯.
 *
 * **The only screen besides Home that scrolls, and the only one that scrolls
 * horizontally.** `44px` for the hand number plus `60px` per player is 416
 * inside 390, so the sixth column bleeds past the right edge on purpose — that
 * clipping is the affordance, and it costs nothing because this screen is
 * opened to settle an argument, not watched all evening.
 *
 * A real `<table>`, not a grid of divs: the data is genuinely tabular, and the
 * element hands a screen reader the row and column association for free rather
 * than through a label on every one of N × M cells.
 */
export const HandHistory = ({ session }: { session: Session }) => {
	const { players, rounds, categories } = session;
	const [mode, setMode] = useState<Mode>("hand");
	/** The cell being corrected, or null. */
	const [fixing, setFixing] = useState<{
		hand: number;
		playerId: string;
	} | null>(null);
	const scroller = useRef<HTMLDivElement>(null);

	// The newest hand is what anyone opens this for, and it is at the foot.
	useEffect(() => {
		const node = scroller.current;
		if (node) node.scrollTop = node.scrollHeight;
	}, []);

	const cellValue = (hand: number, playerId: string) => {
		const round = rounds[hand];
		if (round === undefined) return 0;
		if (mode === "hand") return roundScore(round, playerId, categories);
		return rounds
			.slice(0, hand + 1)
			.reduce((sum, each) => sum + roundScore(each, playerId, categories), 0);
	};

	return (
		<div className="flex h-dvh flex-col">
			<ScreenHeader
				title={m.history_title()}
				subtitle={m.history_sub({
					session: session.name,
					hands: rounds.length,
					players: players.length,
				})}
				leading={
					<BackLink
						to="/session/$id"
						params={{ id: session.id }}
						icon={X}
						label={m.sheet_close()}
					/>
				}
			/>

			<div className="mx-4 mt-3 mb-3 flex shrink-0 overflow-hidden rounded-ctrl border border-line bg-card">
				{(["hand", "running"] as const).map((option) => (
					<button
						key={option}
						type="button"
						onClick={() => setMode(option)}
						aria-pressed={mode === option}
						className={`h-[var(--h-tap)] flex-1 text-body ${
							mode === option
								? "bg-ink font-[var(--weight-semi)] text-paper"
								: "text-ink-soft"
						}`}
					>
						{option === "hand" ? m.history_per_hand() : m.history_running()}
					</button>
				))}
			</div>

			{rounds.length === 0 ? (
				<p className="min-h-0 flex-1 px-4 text-body text-ink-soft">
					{m.history_empty()}
				</p>
			) : (
				<div ref={scroller} className="min-h-0 flex-1 overflow-auto">
					{/* `border-separate` on purpose: with `border-collapse: collapse`
					    a sticky <th> loses its border, and sticky on a <tr> is ignored
					    outright — so both axes pin from the cells, not the rows. */}
					<table
						aria-label={m.history_title()}
						className="w-max border-separate border-spacing-0 text-left"
					>
						<thead>
							<tr>
								<th
									scope="col"
									className="sticky top-0 left-0 z-30 w-11 border-line-strong border-b-2 bg-paper-dim pt-2.5 pb-2 pl-3 font-mono text-eyebrow tracking-eyebrow font-[var(--weight-normal)] text-ink-soft uppercase"
								>
									{m.ledger_hand()}
								</th>
								{players.map((player) => (
									<th
										key={player.id}
										scope="col"
										className="sticky top-0 z-20 w-15 border-line-strong border-b-2 bg-paper-dim pt-2.5 pb-2"
									>
										<span className="flex justify-center">
											<PlayerToken
												name={player.name}
												colorIndex={player.colorIndex}
												size={24}
											/>
											<span className="sr-only">{player.name}</span>
										</span>
									</th>
								))}
							</tr>
						</thead>

						<tbody>
							{rounds.map((_, hand) => (
								<tr
									// Hands are identified by position and never reordered.
									// biome-ignore lint/suspicious/noArrayIndexKey: the index is the hand number
									key={hand}
									className="h-14"
								>
									{/* Hands pin down the left column, so the axis stays
									    labelled once the sixth player scrolls into view. */}
									<th
										scope="row"
										className="num sticky left-0 z-10 border-line border-b bg-paper pl-3 text-left font-mono text-meta font-[var(--weight-normal)] text-ink-soft"
									>
										{hand + 1}
									</th>

									{players.map((player) => {
										const value = cellValue(hand, player.id);
										// A grid of zeros buries the one scoring hand in an Uno
										// row, so a zero is drawn as a faint interpunct.
										const glyph = value === 0 ? "·" : value;
										const tone =
											value === 0
												? "text-ink-faint"
												: "font-[var(--weight-semi)] text-ink";

										return (
											<td
												key={player.id}
												className="border-line border-b p-0 text-center"
											>
												{/* Correcting a running total is not something
												    anyone means, so only per-hand is editable. */}
												{mode === "hand" ? (
													<button
														type="button"
														onClick={() =>
															setFixing({ hand, playerId: player.id })
														}
														className={`num h-14 w-full text-strong ${tone}`}
													>
														{glyph}
													</button>
												) : (
													<span className={`num text-strong ${tone}`}>
														{glyph}
													</span>
												)}
											</td>
										);
									})}
								</tr>
							))}
						</tbody>

						<tfoot>
							<tr className="h-16">
								<th
									scope="row"
									className="sticky bottom-0 left-0 z-30 border-line-strong border-t-2 bg-card pl-3 text-left font-mono text-eyebrow tracking-eyebrow font-[var(--weight-normal)] text-ink-soft uppercase"
								>
									{m.history_total()}
								</th>
								{players.map((player) => (
									<td
										key={player.id}
										className="num sticky bottom-0 z-20 border-line-strong border-t-2 bg-card text-center text-strong font-[var(--weight-bold)] text-ink"
									>
										{playerTotal(rounds, player.id, categories)}
									</td>
								))}
							</tr>
						</tfoot>
					</table>
				</div>
			)}

			<div className="flex shrink-0 items-center justify-between border-line border-t bg-paper-dim px-4 pt-3 pb-5 font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
				<span className="num">{m.history_count({ n: rounds.length })}</span>
				<span className="text-accent">{m.history_tap_to_fix()}</span>
			</div>

			{fixing && (
				<EntrySheet
					key={`${fixing.hand}-${fixing.playerId}`}
					session={session}
					roundIndex={fixing.hand}
					startPlayerId={fixing.playerId}
					onClose={() => setFixing(null)}
				/>
			)}
		</div>
	);
};
