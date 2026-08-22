import { Link } from "@tanstack/react-router";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { m } from "@/paraglide/messages";

type BackLinkProps = {
	to: string;
	params?: Record<string, string>;
	/** Hand history closes rather than goes back, so it draws an ×. */
	icon?: LucideIcon;
	label?: string;
};

/**
 * The header's back control (`1f`, `1h`): a 40px box inside a 44px hit area.
 * The box is what the artboards draw; the hit area is the thumb contract, and
 * the two are different numbers on purpose.
 */
export const BackLink = ({
	to,
	params,
	icon: Icon = ArrowLeft,
	label,
}: BackLinkProps) => (
	<Link
		to={to}
		params={params}
		aria-label={label ?? m.back()}
		className="-ml-1 flex h-[var(--h-tap)] w-[var(--h-tap)] shrink-0 items-center justify-center"
	>
		<span className="flex h-[var(--h-icon-btn)] w-[var(--h-icon-btn)] items-center justify-center rounded-ctrl border border-line bg-card text-ink-soft">
			<Icon size={18} aria-hidden="true" />
		</span>
	</Link>
);
