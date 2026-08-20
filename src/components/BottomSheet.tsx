import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { m } from "@/paraglide/messages";

/** Past this much of a downward drag, letting go dismisses the sheet. */
const DISMISS_AFTER_PX = 60;

type BottomSheetProps = {
	title: string;
	/** Sits left of the title: the player's token on the colour sheet. */
	leading?: ReactNode;
	children: ReactNode;
	onClose: () => void;
};

/**
 * The app's only overlay (`1h`, `1j`, `2c`).
 *
 * A native <dialog>, so the backdrop, the focus trap, Esc and inertness are the
 * browser's job. Styling makes it a bottom sheet; that is a rendering choice
 * and does not make it a *dialog* in the spec's sense — the one confirmation
 * dialog in this app is deleting a session.
 *
 * Dismissed three ways: the ×, a tap on the scrim, and a downward drag on the
 * grab handle. The drag is three pointer handlers rather than a gesture
 * library — the whole interaction is one axis and one threshold.
 */
export const BottomSheet = ({
	title,
	leading,
	children,
	onClose,
}: BottomSheetProps) => {
	const dialog = useRef<HTMLDialogElement>(null);
	const panel = useRef<HTMLDivElement>(null);
	const dragFrom = useRef<number | null>(null);
	const [dragged, setDragged] = useState(0);
	const [closing, setClosing] = useState(false);
	const isClosing = useRef(false);

	// The exit animation has to finish before the sheet leaves the tree, so
	// closing is a state rather than an immediate unmount. The ref carries the
	// same fact to the animation listener, which is registered once.
	const dismiss = () => {
		isClosing.current = true;
		setClosing(true);
	};

	useEffect(() => {
		const node = panel.current;
		if (!node) return;
		const onEnd = () => {
			if (isClosing.current) onClose();
		};
		node.addEventListener("animationend", onEnd);
		return () => node.removeEventListener("animationend", onEnd);
	}, [onClose]);

	useEffect(() => {
		const element = dialog.current;
		if (!element) return;
		element.showModal();

		// The scrim is ::backdrop, which is not an element React can take a
		// handler for: a click on it reports the dialog itself as the target.
		const onBackdropClick = (event: MouseEvent) => {
			if (event.target !== element) return;
			isClosing.current = true;
			setClosing(true);
		};
		element.addEventListener("click", onBackdropClick);
		return () => element.removeEventListener("click", onBackdropClick);
	}, []);

	return (
		<dialog
			ref={dialog}
			onClose={onClose}
			onCancel={(event) => {
				// Esc: animate out rather than vanishing.
				event.preventDefault();
				dismiss();
			}}
			aria-label={title}
			className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-[var(--scrim)]"
		>
			<div style={{ transform: `translateY(${dragged}px)` }}>
				<div
					ref={panel}
					className="rounded-t-card border-line border-t bg-card px-4 pt-2.5 pb-6 shadow-sheet"
					style={{
						animation: `${closing ? "sheet-out" : "sheet-in"} var(--dur-sheet) var(--ease) both`,
					}}
				>
					{/* The grab handle. Dragging is a convenience on top of the × and
					    the scrim, so it carries no label of its own. */}
					<div
						aria-hidden="true"
						className="mx-auto mb-4 h-1 w-9 cursor-grab touch-none rounded-token bg-line"
						onPointerDown={(event) => {
							dragFrom.current = event.clientY;
							event.currentTarget.setPointerCapture(event.pointerId);
						}}
						onPointerMove={(event) => {
							if (dragFrom.current === null) return;
							setDragged(Math.max(0, event.clientY - dragFrom.current));
						}}
						onPointerUp={() => {
							if (dragged > DISMISS_AFTER_PX) dismiss();
							dragFrom.current = null;
							setDragged(0);
						}}
					/>

					<div className="mb-4 flex items-center gap-2.5">
						{leading}
						<h2 className="min-w-0 flex-1 truncate text-strong font-[var(--weight-semi)] text-ink">
							{title}
						</h2>
						<button
							type="button"
							onClick={dismiss}
							aria-label={m.sheet_close()}
							className="flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center text-ink-soft"
						>
							<X size={18} aria-hidden="true" />
						</button>
					</div>

					{children}
				</div>
			</div>
		</dialog>
	);
};
