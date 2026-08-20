import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSettings } from "@/hooks/useSettings";
import { ranking } from "@/lib/scoring";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { gameName } from "@/utils/gameName";
import { CategoryHead } from "./CategoryHead";
import { CategoryStrip } from "./CategoryStrip";
import { PagerDots } from "./PagerDots";
import { SheetRow } from "./SheetRow";

/** Sheet mode holds exactly one round, forever. */
const entriesOf = (session: Session) => session.rounds[0] ?? {};

/**
 * The scoresheet for `mode: "sheet"` (`1c`, `1k`).
 *
 * One category at a time: 7 categories × 7 players is 49 cells, which on 390px
 * is either a horizontal scroll or 40px cells. Seven screens of seven full
 * rows instead — the category's rule gets the whole width, the table hears one
 * question at a time, and every number sits beside its peers, which is how a
 * typo is actually caught.
 */
export const SheetScreen = ({ session }: { session: Session }) => {
	const { locale } = useSettings();
	const [current, setCurrent] = useState(0);
	const [focused, setFocused] = useState<string | null>(null);

	const category = session.categories[current];
	const entries = entriesOf(session);
	const ranked = ranking(session);
	const isLast = current === session.categories.length - 1;

	if (!category) return null;

	const valueFor = (playerId: string, key: string) => entries[playerId]?.[key];
	const isCategoryDone = (index: number) => {
		const key = session.categories[index]?.key;
		return (
			key !== undefined &&
			session.players.every((player) => valueFor(player.id, key) !== undefined)
		);
	};

	return (
		<div className="flex h-dvh flex-col">
			<ScreenHeader
				title={session.name}
				subtitle={
					session.entry === "team"
						? m.sheet_sub_teams({
								game: gameName(session.templateId),
								count: session.players.length,
							})
						: m.sheet_sub_players({
								game: gameName(session.templateId),
								count: session.players.length,
							})
				}
				leading={<BackLink to="/" />}
				trailing={
					<button
						type="button"
						aria-label={m.menu_open()}
						className="flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center"
					>
						<span className="flex h-[var(--h-icon-btn)] w-[var(--h-icon-btn)] items-center justify-center rounded-ctrl border border-line bg-card text-ink-soft">
							<MoreHorizontal size={18} aria-hidden="true" />
						</span>
					</button>
				}
			/>

			<CategoryStrip
				categories={session.categories}
				current={current}
				isDone={isCategoryDone}
				onPick={setCurrent}
			/>

			<CategoryHead
				category={category}
				index={current}
				total={session.categories.length}
			/>

			<ul className="min-h-0 flex-1 overflow-y-auto">
				{session.players.map((player) => {
					const entry = ranked.find((rank) => rank.player.id === player.id);

					return (
						<SheetRow
							key={player.id}
							player={player}
							total={entry?.total ?? 0}
							rank={entry?.rank ?? session.players.length}
							tied={entry?.tied ?? false}
							value={valueFor(player.id, category.key)}
							focused={focused === player.id}
							locale={locale}
							onFocus={() => setFocused(player.id)}
						/>
					);
				})}
			</ul>

			<div className="shrink-0 border-line border-t px-4 pt-3 pb-5">
				<PagerDots
					dots={session.players.map((player) => ({
						id: player.id,
						entered: valueFor(player.id, category.key) !== undefined,
					}))}
				/>

				<button
					type="button"
					onClick={() => setCurrent(current + 1)}
					disabled={isLast}
					className="btn-primary mt-3 flex h-[var(--h-primary)] w-full items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)] disabled:opacity-50"
				>
					{isLast ? m.sheet_see_results() : m.sheet_next_category()} →
				</button>
			</div>
		</div>
	);
};
