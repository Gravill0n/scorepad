import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useSettings } from "@/hooks/useSettings";
import { getMeta } from "@/lib/db";
import { m } from "@/paraglide/messages";
import type { Template } from "@/types/template";
import { startSession } from "../api/startSession";
import {
	addRow,
	fillFirstEmpty,
	initialRows,
	moveRow,
	recolorRow,
	removeRow,
	renameRow,
	type SetupRow,
} from "../utils/setupRows";
import { validateSetup } from "../utils/validateSetup";
import { ColorSheet } from "./ColorSheet";
import { PlayerSetupRow } from "./PlayerSetupRow";
import { RecentNames } from "./RecentNames";
import { problemAction, SetupProblemBanner } from "./SetupProblemBanner";

/** `Wingspan · 1 to 5`, `Belote · exactement 2 équipes`. */
const subtitle = (template: Template) => {
	const [min, max] = template.players;
	const game = template.name;

	if (template.entry === "team") {
		return min === max
			? m.setup_sub_exact_teams({ game, count: min })
			: m.setup_sub_range_teams({ game, min, max });
	}
	return min === max
		? m.setup_sub_exact({ game, count: min })
		: m.setup_sub_range({ game, min, max });
};

/**
 * Player setup (`1h`), and the same screen for the two team games (`1i`).
 *
 * There is no team model: a team is a scoring entry whose name happens to hold
 * two people. `entry` changes the labels on this screen and nothing else.
 */
export const PlayerSetup = ({ template }: { template: Template }) => {
	const [rows, setRows] = useState<SetupRow[]>(() => initialRows(template));
	const [recent, setRecent] = useState<string[]>([]);
	/** The row whose colour sheet is open, if any. */
	const [recoloring, setRecoloring] = useState<string | null>(null);
	const [starting, setStarting] = useState(false);
	const { locale } = useSettings();
	const navigate = useNavigate();
	const max = template.players[1];
	const isTeam = template.entry === "team";
	const problem = validateSetup(rows, template);
	const recoloringRow = rows.find((row) => row.id === recoloring);

	// A pill has somewhere to go until the table is both full and fully named.
	const isFull = (current: SetupRow[]) =>
		current.length >= max && current.every((row) => row.name.trim() !== "");

	useEffect(() => {
		void getMeta("recentNames").then((names) => setRecent(names ?? []));
	}, []);

	const sensors = useSensors(
		// A short distance first, so a thumb resting on the grip while scrolling
		// does not start a drag.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const onStart = async () => {
		if (problem !== null || starting) return;
		setStarting(true);
		try {
			const session = await startSession({ template, rows, locale });
			await navigate({ to: "/session/$id", params: { id: session.id } });
		} catch (error) {
			// The write failed, so the session does not exist. Staying on the
			// screen with the typed names intact is the only useful outcome.
			console.error("could not start the session", error);
			setStarting(false);
		}
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		setRows((current) =>
			moveRow(
				current,
				current.findIndex((row) => row.id === active.id),
				current.findIndex((row) => row.id === over.id),
			),
		);
	};

	return (
		<div className="flex h-dvh flex-col">
			<ScreenHeader
				title={isTeam ? m.setup_title_teams() : m.setup_title_players()}
				subtitle={subtitle(template)}
				leading={<BackLink to="/new" />}
				trailing={
					<span className="num shrink-0 font-mono text-meta text-accent">
						{m.setup_count({ count: rows.length, max })}
					</span>
				}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto px-4">
				{isTeam && template.setupNote !== undefined && (
					<p className="flex gap-2.5 rounded-card border border-advisory bg-advisory-bg p-3.5 text-meta leading-normal text-advisory-ink text-pretty">
						<Users size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
						{template.setupNote}
					</p>
				)}

				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={onDragEnd}
				>
					<SortableContext
						items={rows.map((row) => row.id)}
						strategy={verticalListSortingStrategy}
					>
						<ul className="mt-2">
							{rows.map((row, index) => (
								<PlayerSetupRow
									key={row.id}
									row={row}
									position={index + 1}
									isTeam={isTeam}
									onRename={(name) =>
										setRows((current) => renameRow(current, row.id, name))
									}
									onRecolor={() => setRecoloring(row.id)}
									onRemove={() =>
										setRows((current) => removeRow(current, row.id))
									}
								/>
							))}
						</ul>
					</SortableContext>
				</DndContext>

				{rows.length < max && (
					<button
						type="button"
						onClick={() => setRows((current) => addRow(current))}
						className="flex h-[var(--h-primary)] w-full items-center gap-2 border-line-dashed border-b border-dashed text-ink-soft"
					>
						<span className="w-6 shrink-0" />
						<span className="flex size-9 shrink-0 items-center justify-center rounded-token border border-line-dashed border-dashed">
							<Plus size={16} aria-hidden="true" />
						</span>
						<span className="text-row">
							{isTeam ? m.setup_add_team() : m.setup_add_player()}
						</span>
					</button>
				)}

				{problem !== null && (
					<SetupProblemBanner problem={problem} template={template} />
				)}

				<RecentNames
					names={recent}
					full={isFull(rows)}
					onPick={(name) =>
						setRows((current) =>
							isFull(current) ? current : fillFirstEmpty(current, name),
						)
					}
				/>
			</div>

			{recoloringRow && (
				<ColorSheet
					name={recoloringRow.name}
					colorIndex={recoloringRow.colorIndex}
					taken={rows.map((other) => other.colorIndex)}
					onPick={(colorIndex) =>
						setRows((current) =>
							recolorRow(current, recoloringRow.id, colorIndex),
						)
					}
					onClose={() => setRecoloring(null)}
				/>
			)}

			<div className="shrink-0 border-line border-t px-4 pt-3.5 pb-5">
				<button
					type="button"
					onClick={() => void onStart()}
					disabled={problem !== null || starting}
					className="btn-primary flex h-[var(--h-primary)] w-full items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)] disabled:opacity-50"
				>
					{m.setup_start()}
				</button>

				{/* Stated twice: the primary dims, and this says what to do about
				    it. Auto-height, because the French line is the longer one. */}
				{problem !== null && (
					<p className="mt-2 text-center text-meta leading-normal text-alarm-ink text-pretty">
						{problemAction(problem)}
					</p>
				)}
			</div>
		</div>
	);
};
