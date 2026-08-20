import { BottomSheet } from "@/components/BottomSheet";
import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import { PALETTE_SIZE, playerColor, playerInitial } from "@/utils/playerColor";

const PALETTE = Array.from({ length: PALETTE_SIZE }, (_, index) => index + 1);

type ColorSheetProps = {
	name: string;
	colorIndex: number;
	/** Every index in use by another row. */
	taken: number[];
	onPick: (colorIndex: number) => void;
	onClose: () => void;
};

/**
 * The colour picker (`1h`). Never a dropdown: a dropdown hides exactly the
 * comparison you need.
 *
 * Taken colours dim to 32% and refuse selection — they dim rather than
 * disappear, so the grid keeps its twelve positions and nothing reflows under
 * a thumb that is already moving.
 */
export const ColorSheet = ({
	name,
	colorIndex,
	taken,
	onPick,
	onClose,
}: ColorSheetProps) => {
	const unavailable = new Set(taken.filter((index) => index !== colorIndex));
	const initial = playerInitial(name);

	return (
		<BottomSheet
			title={
				name.trim() === "" ? m.colour_title_unnamed() : m.colour_title({ name })
			}
			leading={<PlayerToken name={name} colorIndex={colorIndex} size={32} />}
			onClose={onClose}
		>
			<ul className="grid grid-cols-4 gap-2.5">
				{PALETTE.map((index) => {
					const isTaken = unavailable.has(index);
					const isSelected = index === colorIndex;

					return (
						<li key={index}>
							<button
								type="button"
								disabled={isTaken}
								aria-disabled={isTaken}
								aria-pressed={isSelected}
								aria-label={
									isTaken
										? m.colour_swatch_taken({ n: index })
										: m.colour_swatch({ n: index })
								}
								onClick={() => onPick(index)}
								className={`flex h-14 w-full items-center justify-center gap-1 rounded-ctrl text-[var(--player-ink)] ${
									isSelected ? "ring-2 ring-ink" : ""
								} ${isTaken ? "opacity-32" : ""}`}
								style={{ background: playerColor(index) }}
							>
								{/* The index is what the database stores; the initial is what
								    makes the token readable when the colour is not. */}
								<span className="num font-mono text-eyebrow opacity-80">
									{index}
								</span>
								<span className="text-row font-[var(--weight-semi)]">
									{initial}
								</span>
							</button>
						</li>
					);
				})}
			</ul>

			<p className="mt-3.5 text-meta leading-normal text-ink-soft text-pretty">
				{m.colour_note()}
			</p>
		</BottomSheet>
	);
};
