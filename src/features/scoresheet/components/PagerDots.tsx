import { m } from "@/paraglide/messages";

/**
 * One disc per player, filled as that player's cell is entered (`1c` footer).
 * It answers "who is still missing?" without making anybody read the column.
 *
 * `role="img"` with a label, because the dots are one picture of progress
 * rather than twelve things to hear about.
 */
export const PagerDots = ({
	dots,
}: {
	dots: { id: string; entered: boolean }[];
}) => (
	<div
		role="img"
		className="flex items-center justify-center gap-1.5"
		aria-label={m.sheet_entered_count({
			done: dots.filter((dot) => dot.entered).length,
			total: dots.length,
		})}
	>
		{dots.map((dot) => (
			<span
				key={dot.id}
				className={`h-1.5 w-1.5 rounded-token ${
					dot.entered ? "bg-accent" : "bg-line"
				}`}
			/>
		))}
	</div>
);
