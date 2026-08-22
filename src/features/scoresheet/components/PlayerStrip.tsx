import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import type { Player } from "@/types/session";

/** Past this many players the tile drops its token and keeps the number. */
const TOKENLESS_FROM = 10;

type PlayerStripProps = {
	players: Player[];
	activeId: string;
	/** Undefined for a player who has not been entered yet — not a zero. */
	valueFor: (playerId: string) => number | undefined;
	onPick: (playerId: string) => void;
};

/**
 * The strip above the keypad (`2c`) — **progress indicator and random access
 * at once.**
 *
 * Tapping any tile jumps to that player, which is the failure a strictly
 * sequential flow could not survive at this table size: somebody corrects
 * themselves two players later and the hand should not have to be restarted.
 */
export const PlayerStrip = ({
	players,
	activeId,
	valueFor,
	onPick,
}: PlayerStripProps) => (
	<ul className="flex gap-1.5">
		{players.map((player) => {
			const value = valueFor(player.id);
			const active = player.id === activeId;

			return (
				<li key={player.id} className="min-w-0 flex-1">
					<button
						type="button"
						onClick={() => onPick(player.id)}
						aria-current={active ? "true" : undefined}
						aria-label={
							value === undefined
								? m.entry_tile_empty({ name: player.name })
								: m.entry_tile({ name: player.name, value })
						}
						className={`flex h-[var(--h-tap)] w-full flex-col items-center justify-center gap-1 rounded-ctrl border ${
							active
								? "border-accent bg-paper-dim"
								: value === undefined
									? "border-line bg-paper-dim"
									: "border-line bg-card"
						}`}
					>
						{players.length < TOKENLESS_FROM && (
							<PlayerToken
								name={player.name}
								colorIndex={player.colorIndex}
								size={18}
							/>
						)}
						<span
							aria-hidden="true"
							className={`num text-strong font-[var(--weight-semi)] leading-none ${
								value === undefined ? "text-ink-faint" : "text-ink"
							}`}
						>
							{value === undefined ? "—" : value}
						</span>
					</button>
				</li>
			);
		})}
	</ul>
);
