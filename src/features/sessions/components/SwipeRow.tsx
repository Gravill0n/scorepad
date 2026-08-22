import { Copy, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { m } from "@/paraglide/messages";

const ACTION =
	"flex w-24 shrink-0 flex-col items-center justify-center gap-1 text-meta font-[var(--weight-medium)]";

/**
 * Swipe a row left to reveal Delete and Duplicate (`1d`).
 *
 * This is CSS scroll-snap, not a gesture library and not pointer-event maths:
 * a horizontally scrollable row with the content and the action pane each
 * snapping. It costs no dependency, it works with a thumb, and — because the
 * actions are real buttons after the row in DOM order — Tab reaches them
 * without the gesture at all.
 */
export const SwipeRow = ({
	label,
	children,
	onDuplicate,
	onDelete,
}: {
	label: string;
	children: ReactNode;
	onDuplicate: () => void;
	onDelete: () => void;
}) => (
	<li
		className="snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		aria-label={m.row_actions({ name: label })}
	>
		<div className="flex">
			<div className="w-full shrink-0 snap-start">{children}</div>

			<div className="flex shrink-0 snap-start bg-alarm-bg">
				<button
					type="button"
					onClick={onDuplicate}
					className={`${ACTION} bg-paper-dim text-ink`}
				>
					<Copy size={18} aria-hidden="true" />
					{m.row_duplicate()}
				</button>
				<button
					type="button"
					onClick={onDelete}
					className={`${ACTION} bg-alarm text-paper`}
				>
					<Trash2 size={18} aria-hidden="true" />
					{m.row_delete()}
				</button>
			</div>
		</div>
	</li>
);
