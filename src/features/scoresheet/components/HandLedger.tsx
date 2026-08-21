import { roundScore } from "@/lib/scoring";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";

/** Six is what the leftover height holds at ≤3 players, and `2e` draws six. */
const VISIBLE_HANDS = 6;

/**
 * The last six hands, under the standings, at three players or fewer (`2e`).
 *
 * The rework had to not regress Belote, which is two rows and a lot of
 * leftover height — so the ledger the old design lived on comes back inline.
 * **Oldest above newest and anchored to the foot**, so the hand just played
 * sits against the entry bar where the thumb already is.
 *
 * At four players the block would show two hands and stop being useful, so it
 * disappears and hand history takes over: one conditional block, same screen,
 * same entry sheet.
 */
export const HandLedger = ({ session }: { session: Session }) => {
	const { players, rounds, categories } = session;
	const shown = rounds.slice(-VISIBLE_HANDS);
	const firstShown = rounds.length - shown.length;

	// The running total has to count every hand, not just the six on screen.
	const runningTo = (index: number, playerId: string) =>
		rounds
			.slice(0, index + 1)
			.reduce((sum, round) => sum + roundScore(round, playerId, categories), 0);

	const columns = `44px repeat(${players.length}, minmax(0, 1fr))`;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div
				className="grid shrink-0 items-end border-line border-b bg-paper-dim px-4 pt-2 pb-1.5 font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase"
				style={{ gridTemplateColumns: columns }}
			>
				<span>{m.ledger_hand()}</span>
				{players.map((player) => (
					<span key={player.id} className="truncate text-right">
						{player.name}
					</span>
				))}
			</div>

			{/* Anchored to the foot: with fewer than six hands the block sits at the
			    bottom of its space rather than floating at the top of it. */}
			<ul className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
				{shown.map((round, index) => {
					const hand = firstShown + index;

					return (
						<li
							key={hand}
							className="grid h-[var(--h-tally-row)] shrink-0 items-center border-line border-b px-4"
							style={{ gridTemplateColumns: columns }}
						>
							<span className="num font-mono text-meta text-ink-soft">
								{hand + 1}
							</span>

							{players.map((player) => (
								<span
									key={player.id}
									className="flex items-baseline justify-end gap-2"
								>
									<span className="num text-strong font-[var(--weight-semi)] text-ink">
										{roundScore(round, player.id, categories)}
									</span>
									<span className="num min-w-8 text-right font-mono text-eyebrow text-ink-soft">
										{runningTo(hand, player.id)}
									</span>
								</span>
							))}
						</li>
					);
				})}
			</ul>
		</div>
	);
};
