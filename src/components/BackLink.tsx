import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { m } from "@/paraglide/messages";

/**
 * The header's back control (`1f`, `1h`): a 40px box inside a 44px hit area.
 * The box is what the artboards draw; the hit area is the thumb contract, and
 * the two are different numbers on purpose.
 */
export const BackLink = ({ to }: { to: string }) => (
	<Link
		to={to}
		aria-label={m.back()}
		className="-ml-1 flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center"
	>
		<span className="flex h-[var(--h-icon-btn)] w-[var(--h-icon-btn)] items-center justify-center rounded-ctrl border border-line bg-card text-ink-soft">
			<ArrowLeft size={18} aria-hidden="true" />
		</span>
	</Link>
);
