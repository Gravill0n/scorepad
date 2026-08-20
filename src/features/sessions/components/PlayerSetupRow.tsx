import { useSortable } from "@dnd-kit/sortable";
import { GripVertical, X } from "lucide-react";
import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import type { SetupRow } from "../utils/setupRows";

type PlayerSetupRowProps = {
	row: SetupRow;
	/** 1-based, for the label a row carries before it has a name. */
	position: number;
	isTeam: boolean;
	onRename: (name: string) => void;
	onRemove: () => void;
};

/**
 * One row of player setup (`1h`): grip, colour token, name, remove.
 *
 * The grip is a real button carrying dnd-kit's listeners, so the same handle
 * serves a thumb and the keyboard — reorder is never a hidden long-press.
 */
export const PlayerSetupRow = ({
	row,
	position,
	isTeam,
	onRename,
	onRemove,
}: PlayerSetupRowProps) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	const label = isTeam
		? m.setup_team_label({ n: position })
		: m.setup_name_label({ n: position });
	const named =
		row.name.trim() === "" ? m.setup_unnamed({ n: position }) : row.name;

	return (
		<li
			ref={setNodeRef}
			style={{
				transform: transform
					? `translate3d(0, ${transform.y}px, 0)`
					: undefined,
				transition,
			}}
			className={`flex h-[var(--h-cell)] items-center gap-2 border-line border-b bg-paper ${
				isDragging ? "relative z-10 opacity-80" : ""
			}`}
		>
			<button
				type="button"
				aria-label={m.setup_reorder({ name: named })}
				className="flex h-[var(--h-tap)] w-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint"
				{...attributes}
				{...listeners}
			>
				<GripVertical size={18} aria-hidden="true" />
			</button>

			<PlayerToken name={row.name} colorIndex={row.colorIndex} />

			<input
				type="text"
				value={row.name}
				onChange={(event) => onRename(event.target.value)}
				aria-label={label}
				placeholder={m.setup_name_placeholder()}
				className="h-full min-w-0 flex-1 bg-transparent text-strong font-[var(--weight-medium)] text-ink outline-none placeholder:text-ink-faint focus-visible:rounded-ctrl focus-visible:shadow-[var(--focus-ring)]"
			/>

			<button
				type="button"
				onClick={onRemove}
				aria-label={m.setup_remove({ name: named })}
				className="flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center text-ink-faint"
			>
				<X size={18} aria-hidden="true" />
			</button>
		</li>
	);
};
