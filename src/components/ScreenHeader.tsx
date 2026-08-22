import type { ReactNode } from "react";

type ScreenHeaderProps = {
	title: ReactNode;
	/** The `game · N players` line under the title, where a screen has one. */
	subtitle?: ReactNode;
	/** Back or close. 40 x 40 inside a 44 hit area, per the artboards. */
	leading?: ReactNode;
	/** The EN/FR chip, a `n / max` counter, the ⋯ menu. */
	trailing?: ReactNode;
};

/**
 * The 52px band every screen opens with.
 *
 * 52 comes from `--h-primary`: the design bundle has no separate header token,
 * and the band and the primary button are the same height by design. If a
 * `--h-header` is ever added, this is the one place it lands.
 */
export const ScreenHeader = ({
	title,
	subtitle,
	leading,
	trailing,
}: ScreenHeaderProps) => (
	<header className="flex min-h-[var(--h-primary)] shrink-0 items-center gap-3 px-4">
		{leading}
		<div className="min-w-0 flex-1">
			<h1 className="truncate font-[var(--weight-bold)] text-screen text-ink">
				{title}
			</h1>
			{subtitle ? (
				<p className="truncate text-meta text-ink-soft">{subtitle}</p>
			) : null}
		</div>
		{trailing}
	</header>
);
