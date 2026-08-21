import { Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { type InstallState, watchInstallState } from "@/lib/installPrompt";
import { m } from "@/paraglide/messages";

/**
 * Add-to-Home-Screen, in the list beside the backup card (`1d`).
 *
 * The third durability mitigation in `data-model.md`, and the one that has to
 * be a screen rather than a call: an installed app survives Safari's ~7-day
 * eviction of unused sites, and a browser tab does not. It is here rather than
 * behind a settings screen for the same reason backup is — there is no settings
 * screen, and this is the list somebody is already looking at.
 *
 * **Not drawn on `1d`.** The spec requires the prompt and the artboards predate
 * it; the card borrows the backup card's shape exactly rather than inventing a
 * second one. It removes itself the moment the app is installed.
 */
export const InstallCard = () => {
	const [state, setState] = useState<InstallState>({ kind: "none" });

	useEffect(() => watchInstallState(setState), []);

	if (state.kind === "none") return null;

	return (
		<div className="rounded-card border border-line bg-card p-4">
			<Eyebrow>{m.install_eyebrow()}</Eyebrow>

			<p className="mt-1.5 text-meta leading-normal text-ink-soft text-pretty">
				{m.install_copy()}
			</p>

			{state.kind === "prompt" ? (
				<button
					type="button"
					onClick={() => void state.prompt()}
					className="mt-3 flex h-[var(--h-tap)] w-full items-center justify-center gap-1.5 rounded-ctrl border border-line bg-paper text-body font-[var(--weight-medium)] text-ink"
				>
					<SquarePlus size={16} aria-hidden="true" />
					{m.install_action()}
				</button>
			) : (
				/* iOS has no install API at all, so the only honest thing the app
				   can do is say where the button is. */
				<p className="mt-3 flex items-center gap-1.5 text-body text-ink">
					<Share size={16} aria-hidden="true" className="shrink-0" />
					{m.install_ios()}
				</p>
			)}
		</div>
	);
};
