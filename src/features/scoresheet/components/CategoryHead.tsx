import { m } from "@/paraglide/messages";
import type { Category } from "@/types/template";

/**
 * The category being scored (`1c`): its label at 28, its rule beneath, and the
 * `N OF M` marker. The rule gets the full 390px because the French text wraps
 * to two lines — that width is the reason the sheet shows one category at a
 * time rather than a grid.
 */
export const CategoryHead = ({
	category,
	index,
	total,
}: {
	category: Category;
	index: number;
	total: number;
}) => (
	<div className="shrink-0 border-line-strong border-b-2 px-4 pb-3.5">
		<p className="num font-mono text-eyebrow tracking-eyebrow text-ink-soft uppercase">
			{m.sheet_category_of({ n: index + 1, total })}
		</p>
		<h2 className="mt-0.5 text-category font-[var(--weight-bold)] text-ink text-pretty">
			{category.label}
		</h2>
		{category.hint !== undefined && (
			<p className="mt-0.5 text-meta leading-normal text-ink-soft text-pretty">
				{category.hint}
			</p>
		)}
	</div>
);
