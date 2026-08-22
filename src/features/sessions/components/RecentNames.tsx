import { m } from "@/paraglide/messages";
import { SectionHeading } from "./SectionHeading";

/**
 * `PLAYED RECENTLY` (`1h`). Names are typed once a year and played all season,
 * so reuse beats typing: tap four pills and the second game night is set up in
 * four taps.
 *
 * The pills are 44px rather than the artboard's 40 — the thumb floor is a
 * contract and this is a tap target like any other.
 */
export const RecentNames = ({
	names,
	full,
	onPick,
}: {
	names: string[];
	/** The table is at the template's maximum, so a pill has nowhere to go. */
	full: boolean;
	onPick: (name: string) => void;
}) => {
	// Hidden rather than dimmed once the table is full and named: the pills can
	// do nothing at that point, and the ~92px they occupy is the difference
	// between a twelve-player counter fitting 844 and scrolling.
	if (names.length === 0 || full) return null;

	return (
		<div className="mt-5">
			<SectionHeading>{m.setup_recent()}</SectionHeading>
			<ul className="mt-3 flex flex-wrap gap-2">
				{names.map((name) => (
					<li key={name}>
						<button
							type="button"
							onClick={() => onPick(name)}
							aria-label={m.setup_recent_add({ name })}
							className="flex h-[var(--h-tap)] items-center rounded-token border border-line bg-card px-3.5 text-body text-ink"
						>
							{name}
						</button>
					</li>
				))}
			</ul>
		</div>
	);
};
