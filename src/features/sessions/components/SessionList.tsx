import { useSettings } from "@/app/provider";
import { Eyebrow } from "@/components/Eyebrow";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { relativeTime } from "@/utils/relativeTime";
import { FinishedRow, InProgressRow } from "./SessionRow";

/** The 2px rule under each section heading (`1d`). */
const SectionHeading = ({ children }: { children: string }) => (
	<div className="border-line-strong border-b-2 pb-1.5">
		<Eyebrow>{children}</Eyebrow>
	</div>
);

/**
 * Home's list (`1d`): in progress, then finished, most recently touched first
 * within each. Never re-sorted by game or by name — the order is how recently
 * you played, because the whole screen exists to resume in one tap.
 *
 * This is the only scrolling surface on the screen.
 */
export const SessionList = ({ sessions }: { sessions: Session[] }) => {
	const { locale } = useSettings();

	// A copy: the store's array is frozen, and sorting in place would rewrite it.
	const byRecency = [...sessions].sort((a, b) =>
		b.updatedAt.localeCompare(a.updatedAt),
	);
	const active = byRecency.filter((session) => session.status === "active");
	const finished = byRecency.filter((session) => session.status === "finished");
	const now = new Date();

	return (
		<div className="flex-1 overflow-y-auto px-4">
			{active.length > 0 && (
				<>
					<SectionHeading>{m.home_in_progress()}</SectionHeading>
					<ul>
						{active.map((session) => (
							<InProgressRow
								key={session.id}
								session={session}
								stamp={relativeTime(session.updatedAt, now, locale)}
							/>
						))}
					</ul>
				</>
			)}

			{finished.length > 0 && (
				<>
					<div className="mt-6">
						<SectionHeading>
							{m.home_finished({ count: finished.length })}
						</SectionHeading>
					</div>
					<ul>
						{finished.map((session) => (
							<FinishedRow
								key={session.id}
								session={session}
								stamp={relativeTime(session.updatedAt, now, locale)}
							/>
						))}
					</ul>
				</>
			)}
		</div>
	);
};
