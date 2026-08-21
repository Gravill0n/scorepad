import { useNavigate } from "@tanstack/react-router";
import { History, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSettings } from "@/hooks/useSettings";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { gameName } from "@/utils/gameName";
import { density, lastHandRecap, passer, standings } from "../utils/tally";
import { EntrySheet } from "./EntrySheet";
import { HandLedger } from "./HandLedger";
import { SessionMenu } from "./SessionMenu";
import { StandingsRow } from "./StandingsRow";

/**
 * The scoresheet for `mode: "tally"` (`2a`, `2b`, `2e`).
 *
 * **Standings are the screen.** One row per player, stacked — the only axis a
 * phone has spare — scaling 2 → 12 by getting denser, never wider. There is no
 * horizontal scroll on the surface the table watches all evening; the per-hand
 * ledger is audit material and lives on its own screen, except at three
 * players or fewer where the leftover height is worth something.
 */
export const TallyScreen = ({ session }: { session: Session }) => {
	const { locale } = useSettings();
	const [menuOpen, setMenuOpen] = useState(false);
	/** Which hand the entry sheet is on, or null when it is closed. */
	const [entering, setEntering] = useState<number | null>(null);
	const navigate = useNavigate();

	const rows = standings(session);
	const tier = density(session.players.length);
	const recap = lastHandRecap(session);
	const passed = passer(session);
	const nextHand = session.rounds.length;

	const subtitle = [
		session.entry === "team"
			? m.sheet_sub_teams({
					game: gameName(session.templateId),
					count: session.players.length,
				})
			: m.sheet_sub_players({
					game: gameName(session.templateId),
					count: session.players.length,
				}),
		session.targetScore === undefined
			? null
			: m.tally_to_target({ target: session.targetScore }),
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="flex h-dvh flex-col">
			<ScreenHeader
				title={session.name}
				subtitle={subtitle}
				leading={<BackLink to="/" />}
				trailing={
					<button
						type="button"
						onClick={() => setMenuOpen(true)}
						aria-label={m.menu_open()}
						className="flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center"
					>
						<span className="flex h-[var(--h-icon-btn)] w-[var(--h-icon-btn)] items-center justify-center rounded-ctrl border border-line bg-card text-ink-soft">
							<MoreHorizontal size={18} aria-hidden="true" />
						</span>
					</button>
				}
			/>

			{/* One line of text, not per-player chips: six players with three-digit
			    scores overflow 390px, and the chips duplicated every row below. */}
			{recap ? (
				<div className="flex shrink-0 items-center gap-2.5 px-4 pt-1 pb-2.5">
					<span className="num min-w-0 flex-1 truncate font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
						{m.tally_recap({
							n: recap.hand,
							name: recap.name,
							score: recap.score,
						})}
					</span>
					{/* The band is ~30px, the hit area is 44: the drawn size and the
					    thumb contract are different numbers, as in the header. */}
					<button
						type="button"
						onClick={() => setEntering(recap.hand - 1)}
						className="-my-2 flex h-[var(--h-tap)] shrink-0 items-center font-mono text-eyebrow tracking-eyebrow text-accent uppercase"
					>
						{m.tally_edit_last()}
					</button>
				</div>
			) : null}

			{/* Ten rows close at 844 exactly. At 11–12 this is the band that gives
			    — never the entry bar, which has to stay under the same thumb at
			    hand 1 and hand 40. */}
			<ul className="min-h-0 overflow-y-auto border-line border-t">
				{rows.map((row) => (
					<StandingsRow
						key={row.player.id}
						row={row}
						tier={tier}
						win={session.win}
						locale={locale}
					/>
				))}
			</ul>

			{tier === "roomy" && session.rounds.length > 0 ? (
				<HandLedger session={session} />
			) : (
				<div className="min-h-0 flex-1" />
			)}

			<div className="shrink-0 border-line-strong border-t-2 bg-card px-4 pt-3 pb-5">
				{/* A fact about the game, not an event needing acknowledgement — so it
				    sits beside the control it names and changes no state. */}
				{passed && session.targetScore !== undefined ? (
					<p className="num pb-2 font-mono text-eyebrow tracking-eyebrow text-advisory-ink uppercase">
						{m.tally_passed({
							name: passed.name,
							target: session.targetScore,
						})}
					</p>
				) : null}

				<button
					type="button"
					onClick={() => setEntering(nextHand)}
					className="btn-primary flex h-[var(--h-key)] w-full items-center justify-center rounded-ctrl text-strong font-[var(--weight-semi)]"
				>
					{m.tally_enter_hand({ n: nextHand + 1 })} →
				</button>
			</div>

			{menuOpen && (
				<SessionMenu
					session={session}
					onClose={() => setMenuOpen(false)}
					onFinished={() =>
						void navigate({
							to: "/session/$id/results",
							params: { id: session.id },
						})
					}
					extraActions={
						<button
							type="button"
							onClick={() =>
								void navigate({
									to: "/session/$id/history",
									params: { id: session.id },
								})
							}
							className="flex h-[var(--h-primary)] w-full items-center gap-3 border-line border-b text-row text-ink"
						>
							<span className="text-ink-soft">
								<History size={18} aria-hidden="true" />
							</span>
							{m.menu_history()}
						</button>
					}
				/>
			)}

			{entering !== null && (
				<EntrySheet
					session={session}
					roundIndex={entering}
					onClose={() => setEntering(null)}
				/>
			)}
		</div>
	);
};
