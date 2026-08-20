import { playerColor, playerInitial } from "@/utils/playerColor";

type PlayerTokenProps = {
	name: string;
	colorIndex: number;
	/** The token's diameter. Setup rows use 36; the colour sheet header 32. */
	size?: number;
};

/**
 * The player's identity, everywhere it appears: a palette colour carrying the
 * player's initial. The initial is not decoration — it is what makes the token
 * readable when the colour is not.
 */
export const PlayerToken = ({
	name,
	colorIndex,
	size = 36,
}: PlayerTokenProps) => (
	<span
		aria-hidden="true"
		className="flex shrink-0 items-center justify-center rounded-token font-[var(--weight-semi)] text-[var(--player-ink)]"
		style={{
			width: size,
			height: size,
			fontSize: Math.round(size * 0.42),
			background: playerColor(colorIndex),
		}}
	>
		{playerInitial(name)}
	</span>
);
