/**
 * The shelf tile's art field (`1f`).
 *
 * No image assets ship in v1, so the art is generated: paper-dim, a hairline,
 * and the game's name set like a box spine. One treatment for every game and
 * no per-game hue — the twelve-colour palette belongs to players, the app has
 * exactly two signal colours, and a per-game colour would be the first thing
 * in the product that means nothing.
 *
 * Self-contained on purpose: real box art later changes what fills this box
 * and nothing about the tile around it.
 *
 * Hidden from assistive tech: it is the cover, and the tile already carries the
 * name in prose underneath. Announcing "Wingspan Wingspan" is what a decorative
 * image with the title baked into it sounds like.
 */
export const TileArt = ({ name }: { name: string }) => (
	<div
		aria-hidden="true"
		className="flex h-[var(--h-cell)] items-center justify-center border-line border-b bg-paper-dim px-2"
	>
		<span className="truncate text-screen tracking-wordmark text-ink-soft uppercase">
			{name}
		</span>
	</div>
);
