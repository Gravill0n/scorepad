import { Check } from "lucide-react";
import { m } from "@/paraglide/messages";
import type { Category } from "@/types/template";
import { categoryChips } from "../utils/categoryChips";

/**
 * One chip per category (`1c`). Done carries a ✓ on paper-dim, current an
 * accent fill and a ●, future a card fill and a hairline — three states told by
 * mark and fill together, never by colour alone.
 *
 * Any chip is tappable: a category is revisited, not re-entered from the start.
 */
export const CategoryStrip = ({
	categories,
	current,
	isDone,
	onPick,
}: {
	categories: Category[];
	current: number;
	isDone: (index: number) => boolean;
	onPick: (index: number) => void;
}) => {
	const chips = categoryChips(categories.map((category) => category.label));

	return (
		<div className="flex shrink-0 gap-1.5 px-4 pb-3">
			{chips.map((chip, index) => {
				const isCurrent = index === current;
				const done = isDone(index);
				const category = categories[index];

				return (
					<button
						key={category?.key ?? chip}
						type="button"
						onClick={() => onPick(index)}
						aria-current={isCurrent ? "step" : undefined}
						aria-label={m.sheet_go_to_category({
							n: index + 1,
							label: category?.label ?? chip,
						})}
						className={`flex h-[var(--h-tap)] flex-1 flex-col items-center justify-center gap-px rounded-chip border ${
							isCurrent
								? "btn-primary border-accent"
								: done
									? "border-line bg-paper-dim text-ink-soft"
									: "border-line bg-card text-ink-soft"
						}`}
					>
						<span className="font-mono text-eyebrow tracking-eyebrow">
							{chip}
						</span>
						<span className="flex h-2.5 items-center text-eyebrow leading-none">
							{isCurrent ? (
								"●"
							) : done ? (
								<Check size={10} aria-hidden="true" />
							) : (
								""
							)}
						</span>
					</button>
				);
			})}
		</div>
	);
};
