import { Flag, Pencil, UserPlus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { updateSession } from "@/lib/sessions";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { newId } from "@/utils/newId";
import { nextColorIndex, PALETTE_SIZE } from "@/utils/playerColor";

type View = "actions" | "rename" | "add-player";

const ROW =
	"flex h-[var(--h-primary)] w-full items-center gap-3 border-line border-b text-row text-ink";

const FIELD =
	"h-[var(--h-cell)] w-full rounded-ctrl border border-line bg-paper px-3 text-body text-ink outline-none focus-visible:border-accent focus-visible:shadow-[var(--focus-ring)]";

const Action = ({
	icon,
	label,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	onClick: () => void;
}) => (
	<button type="button" onClick={onClick} className={ROW}>
		<span className="text-ink-soft">{icon}</span>
		{label}
	</button>
);

/**
 * The ⋯ menu, shared by both scoresheet modes: rename, add a late player,
 * finish. Built once here; tally adds hand history to the same list.
 *
 * A late player appends rather than rewriting anything — the rounds already
 * played simply have no entry for them, which scoring already reads as zero.
 * That is why this can be a one-line append and not a migration.
 */
export const SessionMenu = ({
	session,
	onClose,
	onFinished,
	extraActions,
}: {
	session: Session;
	onClose: () => void;
	onFinished: () => void;
	/** Tally mode adds hand history here (task 27). */
	extraActions?: ReactNode;
}) => {
	const [view, setView] = useState<View>("actions");
	const [draft, setDraft] = useState("");
	const isTeam = session.entry === "team";
	// The palette is the only hard cap: a late player is by definition outside
	// the template's range, so the range is not the thing to enforce here.
	const canAdd = session.players.length < PALETTE_SIZE;

	const rename = (close: () => void) => {
		void updateSession(session.id, { name: draft.trim() });
		close();
	};

	const addPlayer = (close: () => void) => {
		void updateSession(session.id, {
			players: [
				...session.players,
				{
					id: newId(),
					name: draft.trim(),
					colorIndex: nextColorIndex(
						session.players.map((player) => player.colorIndex),
					),
					sortOrder: session.players.length,
				},
			],
		});
		close();
	};

	const finish = (close: () => void) => {
		void updateSession(session.id, {
			status: "finished",
			finishedAt: new Date().toISOString(),
		}).then(onFinished);
		close();
	};

	return (
		<BottomSheet title={session.name} onClose={onClose}>
			{(close) => {
				if (view === "actions") {
					return (
						<div className="flex flex-col">
							<Action
								icon={<Pencil size={18} aria-hidden="true" />}
								label={m.menu_rename()}
								onClick={() => {
									setDraft(session.name);
									setView("rename");
								}}
							/>
							{canAdd && (
								<Action
									icon={<UserPlus size={18} aria-hidden="true" />}
									label={isTeam ? m.setup_add_team() : m.setup_add_player()}
									onClick={() => {
										setDraft("");
										setView("add-player");
									}}
								/>
							)}
							{extraActions}
							<Action
								icon={<Flag size={18} aria-hidden="true" />}
								label={m.menu_finish()}
								onClick={() => finish(close)}
							/>
						</div>
					);
				}

				const isRename = view === "rename";
				const label = isRename
					? m.menu_name_label()
					: isTeam
						? m.menu_new_team_label()
						: m.menu_new_player_label();

				return (
					<div className="flex flex-col gap-3">
						<label className="text-meta text-ink-soft">
							{label}
							<input
								type="text"
								value={draft}
								// The one field in the app that wants the system keyboard:
								// it is a name, not a score.
								onChange={(event) => setDraft(event.target.value)}
								aria-label={label}
								className={`${FIELD} mt-1.5`}
							/>
						</label>

						{!isRename && (
							<p className="text-meta leading-normal text-ink-soft text-pretty">
								{m.menu_late_player_note()}
							</p>
						)}

						<button
							type="button"
							disabled={draft.trim() === ""}
							onClick={() => (isRename ? rename(close) : addPlayer(close))}
							className="btn-primary flex h-[var(--h-primary)] w-full items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)] disabled:opacity-50"
						>
							{isRename ? m.menu_save() : m.menu_add()}
						</button>
					</div>
				);
			}}
		</BottomSheet>
	);
};
