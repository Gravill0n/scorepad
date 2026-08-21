import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { Keypad } from "@/components/Keypad";
import { PlayerToken } from "@/components/PlayerToken";
import { setCell } from "@/lib/sessions";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { fromNumber, type KeypadValue, toNumber } from "@/utils/keypadValue";
import { handPlaced } from "../utils/tally";
import { PlayerStrip } from "./PlayerStrip";

type EntrySheetProps = {
	session: Session;
	/** Which hand is being entered — `rounds.length` for a new one. */
	roundIndex: number;
	/** Where the sheet opens. Hand history hands it the cell that was tapped. */
	startPlayerId?: string;
	onClose: () => void;
};

/**
 * One sheet walks the table (`2c`).
 *
 * The old design gave each player a box, which stops working at ten. This
 * keeps **one keypad and moves the cursor**: type, hand the phone on, repeat.
 * The primary always names who is next — that is the whole pass-the-phone
 * affordance, and it needs no explanation.
 *
 * **The hand saves regardless of balance.** Every keystroke is already on disk,
 * so there is no save action to refuse: shooting the moon scores 26 to each
 * opponent or −26 to the shooter, both legal and both unbalanced. The
 * `handTotal` clause below counts; it never vetoes the table.
 */
export const EntrySheet = ({
	session,
	roundIndex,
	startPlayerId,
	onClose,
}: EntrySheetProps) => {
	const first = startPlayerId ?? session.players[0]?.id ?? "";
	const [activeId, setActiveId] = useState(first);
	const round = session.rounds[roundIndex] ?? {};
	// Tally templates hold one category; the hand is that single number.
	const categoryKey = session.categories[0]?.key ?? "";

	const stored = (playerId: string) => round[playerId]?.[categoryKey];
	const [typed, setTyped] = useState<KeypadValue>(fromNumber(stored(first)));

	const active = session.players.find((player) => player.id === activeId);
	const seat = session.players.findIndex((player) => player.id === activeId);
	const nextPlayer = session.players[seat + 1];

	if (!active) return null;

	/**
	 * Every keystroke lands on disk. The store re-reads the session inside the
	 * write, so two cells entered in quick succession cannot overwrite each
	 * other from one stale snapshot.
	 */
	const onType = (next: KeypadValue) => {
		setTyped(next);
		void setCell(session.id, {
			playerId: activeId,
			categoryKey,
			value: toNumber(next),
			roundIndex,
		});
	};

	const jumpTo = (playerId: string) => {
		setActiveId(playerId);
		setTyped(fromNumber(stored(playerId)));
	};

	// The counter has to move with the thumb, not with the database round trip:
	// the person typing is looking at it. Everyone else reads from storage.
	const live = toNumber(typed);
	const placed = handPlaced(
		{
			...round,
			[activeId]: live === undefined ? {} : { [categoryKey]: live },
		},
		session.categories,
	);

	return (
		<BottomSheet
			title={active.name}
			leading={
				<PlayerToken
					name={active.name}
					colorIndex={active.colorIndex}
					size={30}
				/>
			}
			onClose={onClose}
		>
			{(close) => (
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2.5 border-line border-b pb-3">
						<p className="num min-w-0 flex-1 truncate font-mono text-eyebrow text-ink-soft uppercase">
							{session.handTotal === undefined ? (
								m.entry_hand({ n: roundIndex + 1 })
							) : (
								// Advisory, in advisory ink, and separate from the save path
								// on purpose: it counts, it does not veto.
								<span className="text-advisory-ink">
									{m.entry_to_place({
										n: roundIndex + 1,
										total: session.handTotal,
										placed,
									})}
								</span>
							)}
						</p>

						<span className="flex items-center gap-0.5">
							<span
								className="num text-total font-[var(--weight-bold)] leading-none text-ink"
								aria-live="polite"
							>
								{typed}
							</span>
							<span className="h-8 w-0.5 bg-accent" aria-hidden="true" />
						</span>
					</div>

					<PlayerStrip
						players={session.players}
						activeId={activeId}
						valueFor={(playerId) =>
							playerId === activeId ? toNumber(typed) : stored(playerId)
						}
						onPick={jumpTo}
					/>

					<Keypad value={typed} onChange={onType} />

					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => onType("")}
							className="flex h-[var(--h-primary)] w-22 shrink-0 items-center justify-center rounded-ctrl border border-line bg-card text-body font-[var(--weight-medium)] text-ink-soft"
						>
							{m.sheet_clear()}
						</button>
						<button
							type="button"
							// The last hand-over dismisses the sheet. The hand is already
							// saved — it was saved keystroke by keystroke.
							onClick={() => (nextPlayer ? jumpTo(nextPlayer.id) : close())}
							className="btn-primary flex h-[var(--h-primary)] flex-1 items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)]"
						>
							{nextPlayer
								? m.sheet_next_player({ name: nextPlayer.name })
								: m.entry_done()}{" "}
							→
						</button>
					</div>
				</div>
			)}
		</BottomSheet>
	);
};
