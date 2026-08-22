import { Link } from "@tanstack/react-router";
import { Plus, Tally5 } from "lucide-react";
import { Eyebrow } from "@/components/Eyebrow";
import { templates } from "@/lib/templates/registry";
import { m } from "@/paraglide/messages";
import { ImportControl } from "./ImportControl";

/**
 * First run (`1e`). The whole list is replaced by one empty state — no
 * onboarding carousel, and no dialog.
 *
 * `Import a backup` sits here on purpose: a fresh device is exactly when
 * somebody needs their JSON back.
 */
export const EmptyHome = () => (
	<>
		<div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
			<Tally5
				size={72}
				strokeWidth={1.5}
				className="text-accent"
				aria-hidden="true"
			/>

			<h2 className="mt-7 font-[var(--weight-bold)] text-screen text-ink">
				{m.home_empty_title()}
			</h2>

			<p className="mt-2.5 text-body leading-relaxed text-ink-soft text-pretty">
				{/* Counted from the registry, so the copy cannot drift when a
				    twelfth template lands. */}
				{m.home_empty_copy({ count: templates.length })}
			</p>

			<div className="mt-6">
				<Eyebrow tone="faint">{m.home_offline_promise()}</Eyebrow>
			</div>
		</div>

		<div className="flex shrink-0 flex-col gap-2.5 px-4 pt-3.5 pb-5">
			<Link
				to="/new"
				className="btn-primary flex h-[var(--h-primary)] items-center justify-center gap-2 rounded-ctrl text-row font-[var(--weight-medium)]"
			>
				<Plus size={18} aria-hidden="true" />
				{m.home_new_game()}
			</Link>

			<ImportControl
				className="flex h-[var(--h-cell)] items-center justify-center gap-2 rounded-ctrl border border-line bg-card text-body font-[var(--weight-medium)] text-ink"
				label={m.home_import_backup()}
			/>
		</div>
	</>
);
