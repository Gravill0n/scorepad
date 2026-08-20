import { useEffect, useRef } from "react";
import { m } from "@/paraglide/messages";

/**
 * The one confirmation dialog in the app. Native <dialog> so the backdrop,
 * focus trap, Esc and inertness are the browser's job rather than ours.
 *
 * Deleting a session is the only irreversible action in a product with no
 * account and no server, which is why it is the only thing that asks.
 */
export const DeleteSessionDialog = ({
	name,
	onCancel,
	onConfirm,
}: {
	name: string;
	onCancel: () => void;
	onConfirm: () => void;
}) => {
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		dialog.current?.showModal();
	}, []);

	return (
		<dialog
			ref={dialog}
			onClose={onCancel}
			aria-labelledby="delete-session-title"
			className="m-auto w-[min(20rem,calc(100vw-2rem))] rounded-card border border-line bg-card p-4 text-ink backdrop:bg-[var(--scrim)]"
		>
			<h2
				id="delete-session-title"
				className="text-strong font-[var(--weight-semi)]"
			>
				{m.delete_title()}
			</h2>
			<p className="mt-2 text-meta leading-normal text-ink-soft text-pretty">
				{m.delete_body({ name })}
			</p>

			<div className="mt-4 flex gap-2">
				<button
					type="button"
					onClick={onCancel}
					className="h-[var(--h-tap)] flex-1 rounded-ctrl border border-line bg-card text-body font-[var(--weight-medium)] text-ink"
				>
					{m.delete_cancel()}
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className="h-[var(--h-tap)] flex-1 rounded-ctrl bg-alarm text-body font-[var(--weight-medium)] text-paper"
				>
					{m.delete_confirm()}
				</button>
			</div>
		</dialog>
	);
};
