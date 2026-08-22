import { useEffect, useRef } from "react";
import { Keypad } from "@/components/Keypad";
import { PlayerToken } from "@/components/PlayerToken";
import { m } from "@/paraglide/messages";
import type { Player } from "@/types/session";
import type { KeypadValue } from "@/utils/keypadValue";

type KeypadPanelProps = {
	player: Player;
	/** `SCIENCE · 45 SO FAR` — whose number this is, and where they stand. */
	categoryLabel: string;
	total: number;
	value: KeypadValue;
	/** Names who is next: the whole pass-the-phone affordance. */
	primaryLabel: string;
	onChange: (next: KeypadValue) => void;
	onClear: () => void;
	onPrimary: () => void;
	onDismiss: () => void;
};

/**
 * The entry surface for one cell (`1j`).
 *
 * **Not a modal sheet.** It carries the sheet's treatment — top radius, shadow,
 * `--dur-sheet` — but no scrim and no inertness, because the rows behind it
 * stay readable on purpose: every number sits beside its peers, and that peer
 * check is how a typo is actually caught. Dimming them would remove the one
 * error correction the layout exists to provide.
 */
export const KeypadPanel = ({
	player,
	categoryLabel,
	total,
	value,
	primaryLabel,
	onChange,
	onClear,
	onPrimary,
	onDismiss,
}: KeypadPanelProps) => {
	const panel = useRef<HTMLDivElement>(null);

	// Esc closes it, the way it closes the sheets that are dialogs.
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onDismiss();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onDismiss]);

	return (
		<div
			ref={panel}
			className="shrink-0 rounded-t-card border-line border-t bg-card px-4 pt-3.5 pb-5 shadow-sheet"
			style={{
				animation: "sheet-in var(--dur-sheet) var(--ease) both",
			}}
		>
			<div className="flex items-center gap-2.5 border-line border-b pb-3">
				<PlayerToken
					name={player.name}
					colorIndex={player.colorIndex}
					size={28}
				/>

				<div className="min-w-0 flex-1">
					<p className="truncate text-body font-[var(--weight-semi)] leading-tight text-ink">
						{player.name}
					</p>
					<p className="num truncate font-mono text-eyebrow text-ink-soft uppercase">
						{categoryLabel} · {m.sheet_so_far({ total })}
					</p>
				</div>

				<div className="flex items-center gap-0.5">
					<span
						className="num text-total font-[var(--weight-bold)] leading-none text-ink"
						// The value being typed, announced as it changes: the person
						// holding the phone is not always the one who called the number.
						aria-live="polite"
					>
						{value}
					</span>
					<span className="h-8 w-0.5 bg-accent" aria-hidden="true" />
				</div>
			</div>

			<div className="mt-3">
				<Keypad value={value} onChange={onChange} />
			</div>

			<div className="mt-3 flex gap-2">
				<button
					type="button"
					onClick={onClear}
					className="flex h-[var(--h-primary)] w-24 shrink-0 items-center justify-center rounded-ctrl border border-line bg-card text-body font-[var(--weight-medium)] text-ink-soft"
				>
					{m.sheet_clear()}
				</button>
				<button
					type="button"
					onClick={onPrimary}
					className="btn-primary flex h-[var(--h-primary)] flex-1 items-center justify-center rounded-ctrl text-row font-[var(--weight-medium)]"
				>
					{primaryLabel} →
				</button>
			</div>
		</div>
	);
};
