import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { BackLink } from "@/components/BackLink";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSettings } from "@/hooks/useSettings";
import { ranking } from "@/lib/scoring";
import { setCell } from "@/lib/sessions";
import { m } from "@/paraglide/messages";
import type { Session } from "@/types/session";
import { gameName } from "@/utils/gameName";
import { fromNumber, type KeypadValue, toNumber } from "@/utils/keypadValue";
import { CategoryHead } from "./CategoryHead";
import { CategoryStrip } from "./CategoryStrip";
import { KeypadPanel } from "./KeypadPanel";
import { PagerDots } from "./PagerDots";
import { SessionMenu } from "./SessionMenu";
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
	/**
	 * What is being typed, as a string: "-" is a minus waiting for digits and ""
	 * is an empty cell, neither of which a number can hold. The database still
	 * receives a number on every keystroke — there is no save action anywhere.
	 */
	const [typed, setTyped] = useState<KeypadValue>("");
	const [menuOpen, setMenuOpen] = useState(false);
	const navigate = useNavigate();

	const category = session.categories[current];
	const entries = entriesOf(session);
	const ranked = ranking(session);
	const isLast = current === session.categories.length - 1;
	const focusedPlayer = session.players.find((player) => player.id === focused);

	if (!category) return null;

	const valueFor = (playerId: string, key: string) => entries[playerId]?.[key];

	/**
	 * Every keystroke lands on disk. There is no save action in this app, and
	 * the store re-reads the session inside the write — patching `rounds`
	 * wholesale from this render would lose a cell entered a moment earlier.
	 */
	const write = (playerId: string, value: number | undefined) => {
		void setCell(session.id, { playerId, categoryKey: category.key, value });
	};

	const focusOn = (playerId: string) => {
		setFocused(playerId);
		setTyped(fromNumber(valueFor(playerId, category.key)));
	};

	const onType = (next: KeypadValue) => {
		if (!focused) return;
		setTyped(next);
		write(focused, toNumber(next));
	};

	/**
	 * The primary names who is next while there is a next player, and names the
	 * next category once the column is walked. The button always says where the
	 * phone is going.
	 */
	// Only meaningful while a player is focused: with none, findIndex is -1 and
	// "the next player" would read as the first, which is not what it means.
	const seat = session.players.findIndex((player) => player.id === focused);
	const nextPlayer = focused === null ? undefined : session.players[seat + 1];
	const primaryLabel = nextPlayer
		? m.sheet_next_player({ name: nextPlayer.name })
		: isLast
			? m.sheet_see_results()
			: m.sheet_next_category();

	const toResults = () =>
		void navigate({ to: "/session/$id/results", params: { id: session.id } });

	/** Forward one category, or off the end of the sheet to Results. */
	const advance = () => {
		if (isLast) {
			toResults();
			return;
		}
		setCurrent(current + 1);
	};

	const onPrimary = () => {
		if (nextPlayer) {
			focusOn(nextPlayer.id);
			return;
		}
		setFocused(null);
		advance();
	};
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
						onClick={() => setMenuOpen(true)}
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
							onFocus={() =>
								focused === player.id ? setFocused(null) : focusOn(player.id)
							}
						/>
					);
				})}
			</ul>

			{menuOpen && (
				<SessionMenu
					session={session}
					onClose={() => setMenuOpen(false)}
					onFinished={() =>
						void navigate({
							to: "/session/$id/results",
							params: { id: session.id },
						})
					}
				/>
			)}

			{focusedPlayer ? (
				<KeypadPanel
					player={focusedPlayer}
					categoryLabel={category.label}
					total={
						ranked.find((rank) => rank.player.id === focusedPlayer.id)?.total ??
						0
					}
					value={typed}
					primaryLabel={primaryLabel}
					onChange={onType}
					onClear={() => onType("")}
					onPrimary={onPrimary}
					onDismiss={() => setFocused(null)}
				/>
			) : (
				<div className="shrink-0 border-line border-t px-4 pt-3 pb-5">
					<PagerDots
						dots={session.players.map((player) => ({
							id: player.id,
							entered: valueFor(player.id, category.key) !== undefined,
						}))}
					/>

					<button
						type="button"
						onClick={advance}
						className="btn-primary mt-3 flex h-[var(--h-primary)] w-full items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)]"
					>
						{isLast ? m.sheet_see_results() : m.sheet_next_category()} →
					</button>
				</div>
			)}
		</div>
	);
};
