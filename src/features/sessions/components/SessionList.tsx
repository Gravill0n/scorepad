import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { getMeta } from "@/lib/db";
import { duplicateSession, removeSession } from "@/lib/sessions";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { relativeTime } from "@/utils/relativeTime";
import { BackupCard } from "./BackupCard";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { InstallCard } from "./InstallCard";
import { NewGameLink } from "./NewGameLink";
import { SectionHeading } from "./SectionHeading";
import { FinishedRow, InProgressRow } from "./SessionRow";
import { SwipeRow } from "./SwipeRow";

/**
 * Home's list (`1d`): in progress, then finished, most recently touched first
 * within each. Never re-sorted by game or by name — the order is how recently
 * you played, because the whole screen exists to resume in one tap.
 *
 * This is the only scrolling surface on the screen — the footer below it is
 * pinned, which is what `SPEC.md` §1 means by a band: the list scrolls under a
 * `New game` primary that never leaves.
 */
export const SessionList = ({ sessions }: { sessions: Session[] }) => {
	const { locale } = useSettings();
	const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
	const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

	useEffect(() => {
		void getMeta("lastExportedAt").then((stamp) =>
			setLastExportedAt(stamp ?? null),
		);
	}, []);

	// A copy: the store's array is frozen, and sorting in place would rewrite it.
	const byRecency = [...sessions].sort((a, b) =>
		b.updatedAt.localeCompare(a.updatedAt),
	);
	const active = byRecency.filter((session) => session.status === "active");
	const finished = byRecency.filter((session) => session.status === "finished");
	const now = new Date();

	return (
		<>
			<div className="flex-1 overflow-y-auto px-4">
				{active.length > 0 && (
					<>
						<SectionHeading>{m.home_in_progress()}</SectionHeading>
						<ul>
							{active.map((session) => (
								<SwipeRow
									key={session.id}
									label={session.name}
									onDuplicate={() => void duplicateSession(session.id)}
									onDelete={() => setPendingDelete(session)}
								>
									<InProgressRow
										session={session}
										stamp={relativeTime(session.updatedAt, now, locale)}
									/>
								</SwipeRow>
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
								<SwipeRow
									key={session.id}
									label={session.name}
									onDuplicate={() => void duplicateSession(session.id)}
									onDelete={() => setPendingDelete(session)}
								>
									<FinishedRow
										session={session}
										stamp={relativeTime(session.updatedAt, now, locale)}
									/>
								</SwipeRow>
							))}
						</ul>
					</>
				)}

				<BackupCard
					sessionCount={sessions.length}
					lastExportedAt={lastExportedAt}
					onExported={setLastExportedAt}
				/>

				{/* Below backup, and only until the app is installed: keeping the
				    games is the more urgent of the two durability mitigations. */}
				<InstallCard />

				{pendingDelete && (
					<DeleteSessionDialog
						name={pendingDelete.name}
						onCancel={() => setPendingDelete(null)}
						onConfirm={() => {
							void removeSession(pendingDelete.id);
							setPendingDelete(null);
						}}
					/>
				)}
			</div>

			{/* `1d`'s pinned footer. Without it the populated list replaced the
			    only route to the picker, and a second game was unreachable. */}
			<div className="shrink-0 px-4 pt-3.5 pb-5">
				<NewGameLink />
			</div>
		</>
	);
};
