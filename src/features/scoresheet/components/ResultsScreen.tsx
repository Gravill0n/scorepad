import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { BackLink } from "@/components/BackLink";
import { Eyebrow } from "@/components/Eyebrow";
import { PlayerToken } from "@/components/PlayerToken";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSettings } from "@/hooks/useSettings";
import { exportSession } from "@/lib/backup";
import { ranking } from "@/lib/scoring";
import { duplicateSession, updateSession } from "@/lib/sessions";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { gameName } from "@/utils/gameName";
import { ordinal } from "../utils/ordinal";
import { emptyCells, takeaway } from "../utils/results";
import { WinnerCard } from "./WinnerCard";

const ACTION =
	"flex h-[var(--h-tap)] min-w-0 flex-1 items-center justify-center rounded-ctrl border border-line bg-card text-body font-[var(--weight-medium)] text-ink";

/**
 * `finished 21:24` — the clock, not a date: Results is read the same evening.
 *
 * Returns null on anything unparseable. `finishedAt` is validated as a string
 * and nothing more, and a backup file is untrusted input — `Intl` throws a
 * RangeError on an Invalid Date, which would take the whole screen down over
 * one bad field. `relativeTime` guards the same way.
 */
const clockTime = (iso: string | undefined, locale: "en" | "fr") => {
	const at = iso === undefined ? Number.NaN : Date.parse(iso);
	if (Number.isNaN(at)) return null;

	return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
		hour: "2-digit",
		minute: "2-digit",
	}).format(at);
};

/**
 * Results (`1n`, `1o`) — **the one moment sorting is allowed.**
 *
 * Everywhere else in the app rows hold seat order so the person you are looking
 * for is where they were last hand. Here the game is over, nobody is mid-entry,
 * and the ranking is the whole point.
 *
 * **A tie stays a tie.** Tied players share the winner block, share the rank
 * number and carry `=` down the list; the tiebreak card states the game's rule
 * and says out loud that the app will not apply it.
 */
export const ResultsScreen = ({ session }: { session: Session }) => {
	const { locale } = useSettings();
	const navigate = useNavigate();

	const ranked = ranking(session);
	const winners = ranked.filter((entry) => entry.rank === 1);
	const isTied = winners.length > 1;
	const game = gameName(session.templateId);
	const note = takeaway(session);
	const missing = emptyCells(session);
	const isFinished = session.status === "finished";
	const finishedAt = clockTime(session.finishedAt, locale);

	const playAgain = () =>
		void duplicateSession(session.id).then((copy) =>
			navigate({ to: "/session/$id", params: { id: copy.id } }),
		);

	/** "Finished" is a state, not a lock — a mis-tap is one tap to undo. */
	const reopen = () =>
		void updateSession(session.id, {
			status: "active",
			finishedAt: undefined,
		}).then(() => navigate({ to: "/session/$id", params: { id: session.id } }));

	return (
		<div className="flex h-dvh flex-col">
			<ScreenHeader
				title={session.name}
				subtitle={
					finishedAt === null
						? // `See results →` reaches this screen mid-game, and passing a
							// target never ends one: there is no finish time to name.
							session.entry === "team"
							? m.sheet_sub_teams({ game, count: session.players.length })
							: m.sheet_sub_players({ game, count: session.players.length })
						: m.results_sub({ game, time: finishedAt })
				}
				leading={
					// Closing a finished game goes to the shelf; closing a peek at a
					// running one goes back to the game, which is where the phone came
					// from and where it has to return.
					isFinished ? (
						<BackLink to="/" icon={X} label={m.sheet_close()} />
					) : (
						<BackLink
							to="/session/$id"
							params={{ id: session.id }}
							icon={X}
							label={m.sheet_close()}
						/>
					)
				}
			/>

			<div className="shrink-0 px-4 pt-1.5">
				<WinnerCard
					winners={winners.map((entry) => entry.player)}
					total={winners[0]?.total ?? 0}
					locale={locale}
				/>

				{/* Only when ranks actually tie *and* the snapshot carries a rule.
				    There is no resolve button, no coin prompt and no confetti. */}
				{isTied && session.tiebreakNote ? (
					<div className="mt-2 rounded-card border border-advisory bg-advisory-bg p-3">
						<p className="font-mono text-eyebrow tracking-eyebrow text-advisory-ink uppercase">
							{m.results_tiebreak({ game })}
						</p>
						<p className="mt-1.5 text-strong font-[var(--weight-medium)] text-ink text-pretty">
							{session.tiebreakNote}
						</p>
						<p className="mt-1.5 text-meta leading-normal text-advisory-ink text-pretty">
							{m.results_tiebreak_note()}
						</p>
					</div>
				) : null}
			</div>

			<div className="mt-3 flex min-h-0 flex-1 flex-col px-4">
				<div className="shrink-0 border-line-strong border-b-2 pb-1">
					<Eyebrow>
						{session.entry === "team"
							? m.results_final_teams({ count: session.players.length })
							: m.results_final_players({ count: session.players.length })}
					</Eyebrow>
				</div>

				{/* Seven players fit; twelve is two rows past the band, and clipping
				    a row out of reach is worse than a scroll. */}
				<ol className="min-h-0 overflow-y-auto">
					{ranked.map((entry) => (
						<li
							key={entry.player.id}
							className="flex h-[var(--h-tally-row)] items-center gap-3 border-line border-b"
						>
							<span className="num w-7 shrink-0 font-mono text-body text-ink-soft">
								<span aria-hidden="true">
									{entry.rank}
									{entry.tied ? "=" : ""}
								</span>
								<span className="sr-only">
									{m.results_rank({ rank: ordinal(entry.rank, locale) })}
								</span>
							</span>

							<PlayerToken
								name={entry.player.name}
								colorIndex={entry.player.colorIndex}
								size={32}
							/>

							<span className="min-w-0 flex-1 truncate text-strong font-[var(--weight-medium)] text-ink">
								{entry.player.name}
							</span>

							<span className="num shrink-0 text-screen font-[var(--weight-semi)] text-ink">
								{entry.total}
							</span>
						</li>
					))}
				</ol>

				<div className="shrink-0 pt-2 pb-1">
					{note ? (
						<p className="num font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
							{session.mode === "tally"
								? m.results_takeaway_tally(note)
								: m.results_takeaway_sheet(note)}
						</p>
					) : null}

					{/* Advisory, never a block: finishing with holes is a legal thing
					    to have done, and the number is here so nobody finds the gap
					    a week later. */}
					{isFinished && missing > 0 ? (
						<p className="num mt-1 font-mono text-eyebrow tracking-eyebrow text-advisory-ink uppercase">
							{m.results_empty_cells({ count: missing })}
						</p>
					) : null}
				</div>
			</div>

			<div className="flex shrink-0 flex-col gap-2 border-line border-t px-4 pt-3 pb-4">
				{/* Three-up rather than a fourth band, so the height budget is
				    unchanged. No icons: three ~111px buttons hold `Rejouer` /
				    `Rouvrir` / `Exporter`, and an icon plus its gap is what would
				    take that away — the spec says the button is what survives. */}
				<div className="flex gap-3">
					<button type="button" onClick={playAgain} className={ACTION}>
						{m.results_play_again()}
					</button>
					{/* Only for a game that was actually closed: offering to reopen a
					    running one is a button that lies about the state. */}
					{isFinished ? (
						<button type="button" onClick={reopen} className={ACTION}>
							{m.results_reopen()}
						</button>
					) : null}
					<button
						type="button"
						onClick={() => {
							exportSession(session);
						}}
						className={ACTION}
					>
						{m.results_export()}
					</button>
				</div>

				<button
					type="button"
					onClick={() => void navigate({ to: "/" })}
					className="btn-primary flex h-[var(--h-primary)] w-full items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)]"
				>
					{m.results_back()}
				</button>
			</div>
		</div>
	);
};
