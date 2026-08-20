import { Search, X } from "lucide-react";
import { useState } from "react";
import { templates } from "@/lib/templates/registry";
import { m } from "@/paraglide/messages";
import { GameTile } from "./GameTile";

/** Case-insensitive substring on the name. Eleven titles need no fuzzy match. */
const matches = (name: string, query: string) =>
	name.toLowerCase().includes(query.trim().toLowerCase());

/**
 * The shelf (`1f`) and its no-match state (`1g`).
 *
 * Every count is derived from the registry, so nothing here says "ten" and has
 * to be corrected when a twelfth template lands.
 *
 * The grid is sized to fit eleven tiles at 390 x 844 without scrolling. Its
 * overflow is a safety valve for a shorter viewport, where clipping the last
 * row out of reach would be strictly worse than a scroll.
 */
export const GameShelf = () => {
	const [query, setQuery] = useState("");
	const shown = templates.filter((template) => matches(template.name, query));

	return (
		<>
			<div className="shrink-0 px-4 pb-3.5">
				<div className="flex h-[var(--h-cell)] items-center gap-2.5 rounded-ctrl border border-line bg-card pl-3 focus-within:border-accent focus-within:shadow-[var(--focus-ring)]">
					<Search
						size={18}
						className="shrink-0 text-ink-faint"
						aria-hidden="true"
					/>
					<input
						type="text"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={m.picker_filter({ count: templates.length })}
						aria-label={m.picker_filter({ count: templates.length })}
						className="h-full min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint"
					/>
					{query !== "" && (
						<button
							type="button"
							onClick={() => setQuery("")}
							aria-label={m.picker_clear_filter()}
							className="flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center"
						>
							<span className="flex h-6.5 w-6.5 items-center justify-center rounded-token bg-paper-dim text-ink-soft">
								<X size={14} aria-hidden="true" />
							</span>
						</button>
					)}
				</div>
			</div>

			{shown.length === 0 ? (
				<>
					<div className="flex flex-1 flex-col items-center justify-center px-9 text-center">
						<h2 className="text-screen font-[var(--weight-bold)] text-ink text-pretty">
							{m.picker_no_match_title({ query: query.trim() })}
						</h2>
						<p className="mt-2.5 text-body leading-relaxed text-ink-soft text-pretty">
							{m.picker_no_match_copy({ count: templates.length })}
						</p>
						{/* The closed set, named. Nobody should hunt for Cribbage twice. */}
						<p className="mt-5 font-mono text-eyebrow leading-loose tracking-eyebrow text-ink-faint uppercase text-pretty">
							{templates.map((template) => template.name).join(" · ")}
						</p>
					</div>

					<div className="shrink-0 px-4 pt-3.5 pb-5">
						<button
							type="button"
							onClick={() => setQuery("")}
							className="flex h-[var(--h-cell)] w-full items-center justify-center rounded-ctrl border border-line bg-card text-body font-[var(--weight-medium)] text-ink"
						>
							{m.picker_clear_filter()}
						</button>
					</div>
				</>
			) : (
				<ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 content-start gap-3 overflow-y-auto overscroll-contain px-4 pb-5">
					{shown.map((template) => (
						<GameTile key={template.id} template={template} />
					))}
				</ul>
			)}
		</>
	);
};
