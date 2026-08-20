import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { templates } from "@/lib/templates/registry";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import {
	sessionProgress,
	sessionTotals,
	sessionWinners,
} from "../utils/summary";

/** The game's display name lives in the template, not in the snapshot. */
const gameName = (session: Session) =>
	templates.find((template) => template.id === session.templateId)?.name ??
	session.templateId;

const progressLabel = (session: Session) => {
	const progress = sessionProgress(session);
	return progress.mode === "tally"
		? m.home_progress_hand({ n: progress.hand })
		: m.home_progress_category({
				n: progress.category,
				total: progress.total,
			});
};

const ModeBadge = ({ mode }: { mode: Session["mode"] }) => (
	<span className="rounded-token border border-line px-1.5 py-0.5 font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
		{mode === "sheet" ? m.badge_sheet() : m.badge_tally()}
	</span>
);

const Stamp = ({ children }: { children: string }) => (
	<span className="font-mono text-eyebrow text-ink-soft uppercase">
		{children}
	</span>
);

/**
 * An in-progress session (`1d`). A card with an accent hairline, because this
 * is the one row somebody is trying to hit across a table.
 */
export const InProgressRow = ({
	session,
	stamp,
}: {
	session: Session;
	stamp: string;
}) => (
	<Link
		to="/session/$id"
		params={{ id: session.id }}
		className="mt-3 flex items-center gap-3 rounded-card border border-accent bg-card p-3.5"
	>
		<span className="min-w-0 flex-1">
			<span className="flex items-center gap-2">
				<span className="truncate text-strong font-[var(--weight-semi)] text-ink">
					{gameName(session)}
				</span>
				<ModeBadge mode={session.mode} />
			</span>

			<span className="mt-0.5 block truncate text-meta text-ink-soft">
				{session.name} · {progressLabel(session)}
			</span>

			<span className="num mt-1.5 block text-body font-[var(--weight-medium)] text-ink">
				{sessionTotals(session).join(" – ")}
				{session.targetScore === undefined ? null : (
					<span className="ml-1 text-meta font-[var(--weight-normal)] text-ink-soft">
						{m.home_of_target({ target: session.targetScore })}
					</span>
				)}
			</span>
		</span>

		<span className="shrink-0 text-right">
			<Stamp>{stamp}</Stamp>
			<span className="mt-2 block text-body font-[var(--weight-medium)] text-accent">
				{m.home_resume()} →
			</span>
		</span>
	</Link>
);

const winnerLabel = (session: Session) => {
	const winners = sessionWinners(session);
	const names = winners.map((player) => player.name);
	if (names.length === 0) return session.name;
	return names.length === 1 && names[0]
		? m.home_winner({ name: names[0] })
		: m.home_joint_winners({ names: names.join(" & ") });
};

/** A finished session (`1d`). A quieter row, and it opens Results, not the sheet. */
export const FinishedRow = ({
	session,
	stamp,
}: {
	session: Session;
	stamp: string;
}) => {
	const totals = sessionTotals(session);
	const best =
		session.win === "lowest" ? Math.min(...totals) : Math.max(...totals);

	return (
		<Link
			to="/session/$id/results"
			params={{ id: session.id }}
			className="flex items-center gap-3 border-line border-b py-4"
		>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-row font-[var(--weight-medium)] text-ink">
					{gameName(session)}
				</span>
				<span className="mt-0.5 block truncate text-meta text-ink-soft">
					{session.name} · {winnerLabel(session)}
					{totals.length > 0 ? ` · ${best}` : ""}
				</span>
			</span>
			<Stamp>{stamp}</Stamp>
			<ChevronRight
				size={18}
				className="shrink-0 text-ink-faint"
				aria-hidden="true"
			/>
		</Link>
	);
};
